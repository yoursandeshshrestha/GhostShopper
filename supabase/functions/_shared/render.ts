import { template as authInvite } from "./templates/auth-invite.ts"
import { template as emailChange } from "./templates/email-change.ts"
import { template as magicLink } from "./templates/magic-link.ts"
import { template as recovery } from "./templates/recovery.ts"
import { template as signup } from "./templates/signup.ts"
import { template as teamInvite } from "./templates/team-invite.ts"

const TEMPLATES: Record<string, string> = {
  "auth-invite": authInvite,
  "email-change": emailChange,
  "magic-link": magicLink,
  recovery,
  signup,
  "team-invite": teamInvite,
}

/**
 * Minimal {{var}} replacement for plain-text email templates.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    return vars[key] ?? ""
  })
}

/**
 * Template files use:
 *   SUBJECT: Your subject here
 *
 *   Body lines...
 */
export function parseTemplate(raw: string): { subject: string; body: string } {
  const normalized = raw.replace(/\r\n/g, "\n").trim()
  const subjectMatch = normalized.match(/^SUBJECT:\s*(.+)\n([\s\S]*)$/)
  if (!subjectMatch) {
    throw new Error("Template must start with SUBJECT: line")
  }
  return {
    subject: subjectMatch[1].trim(),
    body: subjectMatch[2].replace(/^\n+/, "").trimEnd() + "\n",
  }
}

export function renderEmail(
  name: string,
  vars: Record<string, string>
): { subject: string; text: string } {
  const raw = TEMPLATES[name]
  if (!raw) {
    throw new Error(`Unknown email template: ${name}`)
  }
  const template = parseTemplate(raw)
  return {
    subject: renderTemplate(template.subject, vars),
    text: renderTemplate(template.body, vars),
  }
}
