import type { EmailTemplate } from "./layout.ts"

export const template: EmailTemplate = {
  subject: "Reset your GhostShopper password",
  html: `<p>We received a request to reset your password for your GhostShopper account.</p>

<p><a href="{{actionUrl}}">Reset your password</a></p>

<p>If you didn't request this, you can safely ignore this email.</p>
`,
  text: `We received a request to reset your password for your GhostShopper account.

{{actionUrl}}

If you didn't request this, you can safely ignore this email.
`,
}
