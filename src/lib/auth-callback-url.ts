const PRODUCTION_APP_URL = 'https://app.ghostshopper.ai'

function configuredAppOrigin(): string | null {
  const fromEnv = import.meta.env.VITE_APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return null
}

function isLocalOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

/** Magic-link / invite emails should land on the deployed app, not localhost. */
export function authCallbackUrl(explicit?: string): string {
  if (explicit) return explicit
  const origin =
    configuredAppOrigin() ??
    (isLocalOrigin(window.location.origin)
      ? PRODUCTION_APP_URL
      : window.location.origin)
  return `${origin.replace(/\/$/, '')}/auth/callback`
}
