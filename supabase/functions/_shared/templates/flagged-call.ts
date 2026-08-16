import type { EmailTemplate } from "./layout.ts"

export const template: EmailTemplate = {
  subject: "Flagged mystery-shop call at {{locationName}}",
  html: `<p>A mystery-shop call at {{locationName}} was flagged and needs review.</p>

<p>{{flagReasons}}</p>

<p><a href="{{reviewUrl}}">Open Review</a></p>
`,
  text: `A mystery-shop call at {{locationName}} was flagged and needs review.

{{flagReasons}}

Open Review:
{{reviewUrl}}
`,
}
