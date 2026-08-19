export const GENERIC_INITIATION_FAILURE =
  "The call could not be placed. Check the location phone number, Twilio outbound permissions, and ElevenLabs telephony setup."

export function humanizeFailureReason(raw: string | null | undefined): string {
  const trimmed = raw?.trim()
  if (!trimmed || trimmed.toLowerCase() === "unknown") {
    return GENERIC_INITIATION_FAILURE
  }
  return trimmed
}

export function sanitizeFailurePayload(value: unknown): unknown {
  if (value == null) return value
  if (typeof value === "string") {
    if (value.length > 500) {
      return `[omitted, ${value.length} chars]`
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeFailurePayload(item))
  }
  if (typeof value === "object") {
    const row = value as Record<string, unknown>
    const next: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(row)) {
      if (key === "full_audio" || key === "audio") {
        const size =
          typeof item === "string"
            ? item.length
            : item instanceof Uint8Array
              ? item.byteLength
              : 0
        next[key] = size > 0 ? `[binary omitted, ${size} bytes]` : item
        continue
      }
      next[key] = sanitizeFailurePayload(item)
    }
    return next
  }
  return value
}

export function buildFailureMetadata(input: {
  source: string
  eventType?: string | null
  rawReason?: string | null
  sipStatus?: string | number | null
  conversationId?: string | null
  payload?: unknown
}): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    source: input.source,
    recorded_at: new Date().toISOString(),
  }

  if (input.eventType) metadata.event_type = input.eventType
  if (input.rawReason?.trim()) metadata.raw_reason = input.rawReason.trim()
  if (input.sipStatus != null && `${input.sipStatus}`.trim()) {
    metadata.sip_status = input.sipStatus
  }
  if (input.conversationId?.trim()) {
    metadata.conversation_id = input.conversationId.trim()
  }
  if (input.payload != null) {
    metadata.payload = sanitizeFailurePayload(input.payload)
  }

  return metadata
}
