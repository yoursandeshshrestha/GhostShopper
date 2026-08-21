import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import {
  buildInvoicePreview,
  clampAdjustmentPercent,
  TIERS,
  type BillingPeriod,
  type SubscriptionCadence,
  type SubscriptionTier,
} from "../_shared/pricing.ts"
import { stripeRequest, StripeError, type StripeCustomer, type StripeInvoice } from "../_shared/stripe.ts"
import { sendMailgunEmail } from "../_shared/mailgun.ts"
import { renderEmail } from "../_shared/render.ts"

type Action = "save_subscription" | "raise_invoice" | "preview"

interface Body {
  action?: Action
  orgId?: string
  tier?: SubscriptionTier
  cadence?: SubscriptionCadence
  billingPeriod?: BillingPeriod
  locationQuantity?: number
  adjustmentPercent?: number
}

const TIERS_SET = new Set<SubscriptionTier>(["local", "growth", "scale", "brand"])
const CADENCE_SET = new Set<SubscriptionCadence>(["weekly", "intensive"])
const PERIOD_SET = new Set<BillingPeriod>(["monthly", "annual"])

async function requireSuperadmin(
  supabaseUrl: string,
  supabaseAnonKey: string,
  authHeader: string,
) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return { ok: false as const, status: 401, error: "Unauthorized" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role !== "superadmin") {
    return {
      ok: false as const,
      status: 403,
      error: "Only platform superadmins can manage billing.",
    }
  }

  return { ok: true as const, userId: user.id }
}

async function activeLocationCount(admin: SupabaseClient, orgId: string) {
  const { count, error } = await admin
    .from("locations")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("opted_out_at", null)
    .is("paused_at", null)
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function billingContact(admin: SupabaseClient, orgId: string) {
  const { data: owner } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("org_id", orgId)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  const ownerEmail = (owner?.email as string | undefined)?.trim()
  if (ownerEmail) {
    return {
      email: ownerEmail,
      name: (owner?.full_name as string | undefined)?.trim() || undefined,
    }
  }

  const { data: invite } = await admin
    .from("invitations")
    .select("email")
    .eq("org_id", orgId)
    .eq("role", "owner")
    .is("accepted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  const inviteEmail = (invite?.email as string | undefined)?.trim()
  return {
    email: inviteEmail || undefined,
    name: undefined,
  }
}

function formatGbpPence(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pence / 100)
}

async function ensureStripeCustomer(
  admin: SupabaseClient,
  org: { id: string; name: string; stripe_customer_id: string | null },
) {
  const contact = await billingContact(admin, org.id)
  if (org.stripe_customer_id) {
    if (contact.email) {
      await stripeRequest("POST", `/customers/${org.stripe_customer_id}`, {
        email: contact.email,
        name: contact.name || org.name,
      })
    }
    return org.stripe_customer_id
  }

  const customer = await stripeRequest<StripeCustomer>("POST", "/customers", {
    name: org.name,
    email: contact.email,
    "metadata[org_id]": org.id,
  })

  const { error } = await admin
    .from("orgs")
    .update({ stripe_customer_id: customer.id })
    .eq("id", org.id)
  if (error) throw new Error(error.message)

  return customer.id
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const authHeader = req.headers.get("Authorization")
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401)
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase env is not configured" }, 500)
  }

  const auth = await requireSuperadmin(supabaseUrl, supabaseAnonKey, authHeader)
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status)

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400)
  }

  const action = body.action
  const orgId = body.orgId?.trim()
  if (!action) return jsonResponse({ error: "action is required" }, 400)
  if (!orgId) return jsonResponse({ error: "orgId is required" }, 400)

  const admin = createClient(supabaseUrl, serviceRoleKey)

  try {
    const { data: org, error: orgError } = await admin
      .from("orgs")
      .select("id, name, stripe_customer_id, subscription_status")
      .eq("id", orgId)
      .maybeSingle()

    if (orgError || !org) {
      return jsonResponse({ error: "Organisation not found" }, 404)
    }

    const { data: existing } = await admin
      .from("subscriptions")
      .select(
        "id, tier, cadence, billing_period, status, location_quantity, first_invoice_raised_at, setup_fee_status, stripe_customer_id",
      )
      .eq("org_id", orgId)
      .maybeSingle()

    const locationCount = await activeLocationCount(admin, orgId)
    const requestedTier = (body.tier ?? existing?.tier ?? "local") as SubscriptionTier
    const requestedCadence =
      (body.cadence ?? existing?.cadence ?? "weekly") as SubscriptionCadence
    const requestedPeriod = (body.billingPeriod ??
      existing?.billing_period ??
      "monthly") as BillingPeriod

    if (!TIERS_SET.has(requestedTier)) {
      return jsonResponse({ error: "Invalid tier" }, 400)
    }
    if (!CADENCE_SET.has(requestedCadence)) {
      return jsonResponse({ error: "Invalid cadence" }, 400)
    }
    if (!PERIOD_SET.has(requestedPeriod)) {
      return jsonResponse({ error: "Invalid billing period" }, 400)
    }

    const planTier =
      action === "raise_invoice" && existing
        ? (existing.tier as SubscriptionTier)
        : requestedTier
    const planCadence =
      action === "raise_invoice" && existing
        ? (existing.cadence as SubscriptionCadence)
        : requestedCadence
    const planPeriod =
      action === "raise_invoice" && existing
        ? (existing.billing_period as BillingPeriod)
        : requestedPeriod
    const tier = planTier
    const cadence = planCadence
    const billingPeriod = planPeriod

    const locationQuantity =
      tier === "brand"
        ? Math.max(
          1,
          Number.isFinite(body.locationQuantity)
            ? Math.round(body.locationQuantity as number)
            : existing?.location_quantity || locationCount || TIERS.brand.minLocations,
        )
        : locationCount

    const isFirstInvoice = !existing?.first_invoice_raised_at
    const adjustmentPercent = clampAdjustmentPercent(body.adjustmentPercent)
    const preview = buildInvoicePreview({
      tier,
      cadence,
      billingPeriod,
      locationQuantity,
      isFirstInvoice,
      adjustmentPercent,
    })

    if (action === "preview") {
      return jsonResponse({
        ok: true,
        preview,
        locationCount,
        isFirstInvoice,
      })
    }

    if (action === "save_subscription") {
      const customerId = await ensureStripeCustomer(admin, {
        id: org.id,
        name: org.name,
        stripe_customer_id: org.stripe_customer_id,
      })

      const payload = {
        org_id: orgId,
        tier,
        cadence,
        billing_period: billingPeriod,
        location_quantity: locationQuantity,
        stripe_customer_id: customerId,
        status: existing?.status === "active" || existing?.status === "past_due"
          ? existing.status
          : "pending",
      }

      const { data: saved, error } = await admin
        .from("subscriptions")
        .upsert(payload, { onConflict: "org_id" })
        .select("*")
        .single()

      if (error || !saved) {
        return jsonResponse(
          { error: error?.message ?? "Could not save subscription." },
          500,
        )
      }

      await admin.from("audit_log").insert({
        org_id: orgId,
        actor_id: auth.userId,
        action: "subscription_updated",
        metadata: {
          tier,
          cadence,
          billing_period: billingPeriod,
          location_quantity: locationQuantity,
        },
      })

      return jsonResponse({ ok: true, subscription: saved, preview, locationCount })
    }

    if (action === "raise_invoice") {
      if (!existing) {
        return jsonResponse(
          { error: "Save the subscription plan before raising an invoice." },
          400,
        )
      }

      const contact = await billingContact(admin, orgId)
      if (!contact.email) {
        return jsonResponse(
          {
            error:
              "This organisation has no owner email. Invite an owner before raising an invoice.",
          },
          400,
        )
      }

      const customerId = await ensureStripeCustomer(admin, {
        id: org.id,
        name: org.name,
        stripe_customer_id: org.stripe_customer_id,
      })

      const invoice = await stripeRequest<StripeInvoice>("POST", "/invoices", {
        customer: customerId,
        collection_method: "send_invoice",
        days_until_due: "14",
        auto_advance: "false",
        currency: "gbp",
        description: `${org.name} · ${TIERS[existing.tier as SubscriptionTier].name} ${existing.billing_period}`,
        "metadata[org_id]": orgId,
        "metadata[subscription_id]": existing.id,
        "metadata[tier]": existing.tier,
        "metadata[cadence]": existing.cadence,
        "metadata[billing_period]": existing.billing_period,
      })

      for (const line of preview.lines) {
        // Invoice items only accept one-time Price objects. Plan prices are
        // recurring, so bill the preview amounts directly.
        await stripeRequest("POST", "/invoiceitems", {
          customer: customerId,
          invoice: invoice.id,
          currency: "gbp",
          description: line.description,
          quantity: line.quantity,
          unit_amount_decimal: String(line.unitAmountPence),
          "metadata[line_key]": line.key,
        })
      }

      await stripeRequest("POST", `/invoices/${invoice.id}/finalize`, {
        auto_advance: "false",
      })
      const sent = await stripeRequest<StripeInvoice>(
        "POST",
        `/invoices/${invoice.id}/send`,
      )

      const invoiceUrl = sent.hosted_invoice_url ?? null
      let emailError: string | null = null
      if (invoiceUrl) {
        const message = renderEmail("invoice", {
          orgName: org.name,
          amount: formatGbpPence(sent.amount_due || preview.totalPence),
          invoiceUrl,
        })
        const mailed = await sendMailgunEmail({
          to: contact.email,
          subject: message.subject,
          text: message.text,
          html: message.html,
        })
        emailError = mailed.error
      } else {
        emailError = "Stripe did not return a payment link."
      }

      const setupFeeStatus = isFirstInvoice
        ? (preview.includesSetupFee ? "charged" : "waived")
        : existing.setup_fee_status

      const { data: row, error: insertError } = await admin
        .from("invoices")
        .insert({
          org_id: orgId,
          subscription_id: existing.id,
          stripe_invoice_id: sent.id,
          status: "open",
          hosted_invoice_url: sent.hosted_invoice_url ?? null,
          currency: "gbp",
          amount_due_pence: sent.amount_due,
          amount_paid_pence: sent.amount_paid,
          includes_setup_fee: preview.includesSetupFee,
          intensive: preview.intensive,
          adjustment_percent: adjustmentPercent > 0 ? adjustmentPercent : null,
          adjustment_pence: preview.adjustmentPence,
          raised_by: auth.userId,
        })
        .select("*")
        .single()

      if (insertError) {
        return jsonResponse({ error: insertError.message }, 500)
      }

      await admin
        .from("subscriptions")
        .update({
          first_invoice_raised_at: existing.first_invoice_raised_at ?? new Date().toISOString(),
          setup_fee_status: setupFeeStatus,
          stripe_customer_id: customerId,
          location_quantity: locationQuantity,
        })
        .eq("id", existing.id)

      if (adjustmentPercent > 0) {
        await admin.from("audit_log").insert({
          org_id: orgId,
          actor_id: auth.userId,
          action: "invoice_adjustment",
          metadata: {
            stripe_invoice_id: sent.id,
            adjustment_percent: adjustmentPercent,
            adjustment_pence: preview.adjustmentPence,
          },
        })
      }

      return jsonResponse({
        ok: true,
        invoice: row,
        hostedInvoiceUrl: invoiceUrl,
        emailedTo: contact.email,
        emailError,
        preview,
      })
    }

    return jsonResponse({ error: "Unknown action" }, 400)
  } catch (error) {
    const message = error instanceof StripeError
      ? error.message
      : error instanceof Error
      ? error.message
      : "Billing request failed"
    return jsonResponse({ error: message }, 500)
  }
})
