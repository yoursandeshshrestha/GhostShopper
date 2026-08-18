import type { EmailTemplate } from "./layout.ts"

export const template: EmailTemplate = {
  subject: "Your GhostShopper account has been suspended",
  html: `<p>Your GhostShopper account has been suspended and you cannot sign in at this time.</p>

<p>If you believe this is a mistake, please contact your administrator to restore access.</p>

<p>If you did not attempt to sign in, you can safely ignore this email.</p>
`,
  text: `Your GhostShopper account has been suspended and you cannot sign in at this time.

If you believe this is a mistake, please contact your administrator to restore access.

If you did not attempt to sign in, you can safely ignore this email.
`,
}
