import type { EmailTemplate } from "./layout.ts"

export const template: EmailTemplate = {
  subject: "Your GhostShopper invoice for {{orgName}}",
  html: `<p>Hello,</p>

<p>Your GhostShopper invoice for {{orgName}} is ready. The amount due is {{amount}}, excluding VAT.</p>

<p><a href="{{invoiceUrl}}">Pay this invoice</a></p>

<p>If you have questions about this invoice, reply to this email or contact GhostShopper.</p>
`,
  text: `Hello,

Your GhostShopper invoice for {{orgName}} is ready. The amount due is {{amount}}, excluding VAT.

Pay this invoice:
{{invoiceUrl}}

If you have questions about this invoice, reply to this email or contact GhostShopper.
`,
}
