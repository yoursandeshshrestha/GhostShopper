import { wrapEmailHtml, type EmailTemplate } from "./templates/layout.ts"
import { template as authInvite } from "./templates/auth-invite.ts"
import { template as emailChange } from "./templates/email-change.ts"
import { template as magicLink } from "./templates/magic-link.ts"
import { template as recovery } from "./templates/recovery.ts"
import { template as signup } from "./templates/signup.ts"
import { template as teamInvite } from "./templates/team-invite.ts"

const TEMPLATES: Record<string, EmailTemplate> = {
  "auth-invite": authInvite,
  "email-change": emailChange,
  "magic-link": magicLink,
  recovery,
  signup,
  "team-invite": teamInvite,
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function interpolate(
  template: string,
  vars: Record<string, string>,
  html: boolean
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = vars[key] ?? ""
    return html ? escapeHtml(value) : value
  })
}

export function renderEmail(
  name: string,
  vars: Record<string, string>
): { subject: string; text: string; html: string } {
  const template = TEMPLATES[name]
  if (!template) {
    throw new Error(`Unknown email template: ${name}`)
  }

  const subject = interpolate(template.subject, vars, false)
  return {
    subject,
    text: interpolate(template.text, vars, false).trimEnd() + "\n",
    html: wrapEmailHtml(subject, interpolate(template.html, vars, true)),
  }
}
