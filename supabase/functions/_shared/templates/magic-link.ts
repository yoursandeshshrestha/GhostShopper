import type { EmailTemplate } from "./layout.ts"

export const template: EmailTemplate = {
  subject: "Your GhostShopper sign-in link",
  html: `<p>Use this link to sign in to GhostShopper:</p>

<p><a href="{{actionUrl}}">Sign in to GhostShopper</a></p>

<p>If you didn't request this, you can safely ignore this email.</p>
`,
  text: `Use this link to sign in to GhostShopper:

{{actionUrl}}

If you didn't request this, you can safely ignore this email.
`,
}
