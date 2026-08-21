import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"
import { jsonResponse } from "../_shared/cors.ts"
import { verifyStripeSignature, type StripeInvoice } from "../_shared/stripe.ts"

function addPeriod(from: Date, billingPeriod: string) {
  const next = new Date(from)
  if (billingPeriod === "annual") {
    next.setUTCFullYear(next.getUTCFullYear() + 1)
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1)
  }
  return next
}

function invoiceStatus(status: string) {
  if (status === "paid") return "paid"
  if (status === "void") return "void"
  if (status === "uncollectible") return "uncollectible"
  if (status === "draft") return "draft"
  return "open"
}

async function applyPaid(
  admin: SupabaseClient,
  invoice: StripeInvoice,
) {
  const metadata = invoice.metadata ?? {}
  const now = new Date()

  const { data: local } = await admin
    .from("invoices")
    .select("id, org_id, subscription_id")
    .eq("stripe_invoice_id", invoice.id)
    .maybeSingle()

  const orgId = local?.org_id ?? metadata.org_id ?? null
  const subscriptionId = local?.subscription_id ?? metadata.subscription_id ?? null

  if (local?.id) {
    await admin
      .from("invoices")
      .update({
        status: "paid",
        amount_due_pence: invoice.amount_due,
        amount_paid_pence: invoice.amount_paid,
        hosted_invoice_url: invoice.hosted_invoice_url ?? null,
        paid_at: now.toISOString(),
      })
      .eq("id", local.id)
  }

  if (!orgId) return

  const { data: subscription } = subscriptionId
    ? await admin
      .from("subscriptions")
      .select("id, billing_period")
      .eq("id", subscriptionId)
      .maybeSingle()
    : await admin
      .from("subscriptions")
      .select("id, billing_period")
      .eq("org_id", orgId)
      .maybeSingle()

  const periodEnd = addPeriod(now, subscription?.billing_period ?? "monthly")

  if (subscription?.id) {
    await admin
      .from("subscriptions")
      .update({
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .eq("id", subscription.id)
  }

  await admin
    .from("orgs")
    .update({
      subscription_status: "active",
      past_due_since: null,
      stripe_customer_id: invoice.customer,
    })
    .eq("id", orgId)
}

async function applyPastDue(
  admin: SupabaseClient,
  invoice: StripeInvoice,
  uncollectible = false,
) {
  const { data: local } = await admin
    .from("invoices")
    .select("id, org_id, subscription_id")
    .eq("stripe_invoice_id", invoice.id)
    .maybeSingle()

  const orgId = local?.org_id ?? invoice.metadata?.org_id ?? null
  if (local?.id) {
    await admin
      .from("invoices")
      .update({
        status: invoiceStatus(invoice.status),
        amount_due_pence: invoice.amount_due,
        amount_paid_pence: invoice.amount_paid,
        hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      })
      .eq("id", local.id)
  }

  if (!orgId || uncollectible) return

  const { data: org } = await admin
    .from("orgs")
    .select("past_due_since, subscription_status")
    .eq("id", orgId)
    .maybeSingle()

  if (org?.subscription_status === "audit") return

  await admin
    .from("orgs")
    .update({
      subscription_status: "past_due",
      past_due_since: org?.past_due_since ?? new Date().toISOString(),
    })
    .eq("id", orgId)

  await admin
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("org_id", orgId)
    .in("status", ["pending", "active", "past_due"])
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase env is not configured" }, 500)
  }

  const rawBody = await req.text()
  const verification = await verifyStripeSignature(
    rawBody,
    req.headers.get("stripe-signature"),
    Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim(),
  )
  if (!verification.ok) {
    return jsonResponse({ error: verification.error }, 400)
  }

  let event: { type?: string; data?: { object?: StripeInvoice } }
  try {
    event = JSON.parse(rawBody) as { type?: string; data?: { object?: StripeInvoice } }
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400)
  }

  const invoice = event.data?.object
  if (!invoice?.id) {
    return jsonResponse({ ok: true, ignored: true })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  try {
    if (event.type === "invoice.paid") {
      await applyPaid(admin, invoice)
    } else if (event.type === "invoice.payment_failed") {
      await applyPastDue(admin, invoice)
    } else if (
      event.type === "invoice.voided" ||
      event.type === "invoice.marked_uncollectible"
    ) {
      await applyPastDue(admin, invoice, true)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed"
    return jsonResponse({ error: message }, 500)
  }

  return jsonResponse({ ok: true })
})
