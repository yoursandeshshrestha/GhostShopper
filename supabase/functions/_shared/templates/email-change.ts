import type { EmailTemplate } from "./layout.ts"

export const template: EmailTemplate = {
  subject: "Confirm your new GhostShopper email",
  html: `<p>Confirm your new email address for GhostShopper:</p>

<p><a href="{{actionUrl}}">Confirm your new email</a></p>

<p>If you didn't request this change, you can safely ignore this email.</p>
`,
  text: `Confirm your new email address for GhostShopper:

{{actionUrl}}

If you didn't request this change, you can safely ignore this email.
`,
}
