import type { EmailTemplate } from "./layout.ts"

export const template: EmailTemplate = {
  subject: "You're invited to GhostShopper",
  html: `<p>You've been invited to GhostShopper.</p>

<p><a href="{{actionUrl}}">Accept your invite</a></p>
`,
  text: `You've been invited to GhostShopper.

Accept your invite:
{{actionUrl}}
`,
}
