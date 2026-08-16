import type { EmailTemplate } from "./layout.ts"

export const template: EmailTemplate = {
  subject: "You're invited to {{orgName}} on GhostShopper",
  html: `<p>You've been invited to join {{orgName}} on GhostShopper as {{role}}.</p>

<p><a href="{{inviteUrl}}">Accept your invite</a></p>

<p>Sign in with this email address ({{email}}) to join.</p>
`,
  text: `You've been invited to join {{orgName}} on GhostShopper as {{role}}.

Accept your invite:
{{inviteUrl}}

Sign in with this email address ({{email}}) to join.
`,
}
