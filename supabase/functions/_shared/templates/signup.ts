import type { EmailTemplate } from "./layout.ts"

export const template: EmailTemplate = {
  subject: "Confirm your GhostShopper email",
  html: `<p>Confirm your email for GhostShopper:</p>

<p><a href="{{actionUrl}}">Confirm your email</a></p>

<p>If you didn't create an account, you can safely ignore this email.</p>
`,
  text: `Confirm your email for GhostShopper:

{{actionUrl}}

If you didn't create an account, you can safely ignore this email.
`,
}
