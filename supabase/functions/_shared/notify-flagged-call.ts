import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import { sendMailgunEmail } from "./mailgun.ts"
import { renderEmail } from "./render.ts"

function appUrl() {
  const raw = Deno.env.get("APP_URL")?.trim()
  if (raw) return raw.replace(/\/$/, "")
  return "https://app.ghostshopper.ai"
}

export async function notifyFlaggedCall(
  admin: SupabaseClient,
  input: {
    orgId: string
    locationId: string
    flagReasons: string[]
  },
) {
  if (!input.locationId) return

  const [{ data: location }, { data: members }] = await Promise.all([
    admin
      .from("locations")
      .select("name")
      .eq("id", input.locationId)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("email, role")
      .eq("org_id", input.orgId)
      .in("role", ["owner", "admin", "coach"]),
  ])

  const recipients = (members ?? [])
    .map((row) => (row.email as string | null)?.trim())
    .filter((email): email is string => Boolean(email))

  if (recipients.length === 0) return

  const locationName = (location?.name as string | undefined)?.trim() || "a location"
  const flagReasons =
    input.flagReasons.length > 0
      ? input.flagReasons.map((reason) => reason.replace(/_/g, " ")).join(", ")
      : "Needs a coach review."

  const content = renderEmail("flagged-call", {
    locationName,
    flagReasons,
    reviewUrl: `${appUrl()}/review`,
  })

  await Promise.all(
    recipients.map((to) =>
      sendMailgunEmail({
        to,
        subject: content.subject,
        text: content.text,
        html: content.html,
      }).catch((error) => {
        console.error("Flagged-call email failed:", to, error)
        return { id: null, error: String(error) }
      })
    ),
  )
}
