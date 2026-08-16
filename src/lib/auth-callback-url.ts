/** Magic-link redirect follows the page you signed in from (localhost or production). */
export function authCallbackUrl(explicit?: string): string {
  if (explicit) return explicit
  return `${window.location.origin}/auth/callback`
}
