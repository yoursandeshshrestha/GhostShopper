# ElevenLabs endpoints

All outbound API calls go through `supabase/functions/_shared/elevenlabs.ts`.
Base URL: `https://api.elevenlabs.io/v1`. Auth header: `xi-api-key`.

## Voice catalog

Used by the admin Voices page (`platform-voices` → `fetchElevenLabsVoices`).

```
GET https://api.elevenlabs.io/v1/voices
```

**No query filters.** The request has no `show_legacy`, `page_size`, `search`, `category`, `voice_type`, or pagination params. ElevenLabs returns the account’s default voice list.

### What we keep from the response

Each row must have `voice_id` and `name`. Mapped fields:

| Field | Source |
|---|---|
| `voiceId` | `voice_id` |
| `name` | `name` |
| `previewUrl` | `preview_url` |
| `labels` | `labels` (string values only) |
| `category` | `category` |
| `description` | `description` |
| `languages` | `labels.language` plus `verified_languages[].language` |

### Filters after fetch (not sent to ElevenLabs)

1. **Server** (`fetchElevenLabsVoices`): drop rows missing `voice_id` or `name`.
2. **Admin UI** (`src/pages/admin/voices/index.tsx`): local tabs and search.

| UI filter | Effect |
|---|---|
| `all` | Show every returned voice |
| `enabled` | `voice.enabled === true` (our `platform_voices` flag) |
| `female` / `male` | `voice.gender` from saved row or inferred from `labels.gender` / `labels.sex` |
| Search box | Case-insensitive match on name, description, category, languages, and label values |

Enabled/disabled and gender overrides are stored in `platform_voices`, not sent as ElevenLabs list filters.

## Outbound call

Default (Twilio):

```
POST https://api.elevenlabs.io/v1/convai/twilio/outbound-call
```

Override with `ELEVENLABS_TELEPHONY_PROVIDER`:

| Value | Endpoint |
|---|---|
| `twilio` (default) | `/v1/convai/twilio/outbound-call` |
| `sip-trunk` | `/v1/convai/sip-trunk/outbound-call` |
| `exotel` | `/v1/convai/exotel/outbound-call` |

Body (no list filters):

- `agent_id` — `ELEVENLABS_AGENT_ID`
- `agent_phone_number_id` — `ELEVENLABS_AGENT_PHONE_NUMBER_ID`
- `to_number` — E.164 (10-digit numbers prefixed with `+91`)
- `call_recording_enabled: true`
- `telephony_call_config.ringing_timeout_secs: 45`
- `conversation_initiation_client_data.dynamic_variables` — call id, location, scenario fields
- `conversation_config_override.agent` — empty `first_message`, `language: "en"`, built prompt
- `conversation_config_override.tts.voice_id` — only if a pool voice was selected

## Conversation, recording, hang-up

| Purpose | Method | Endpoint |
|---|---|---|
| Fetch conversation | `GET` | `/v1/convai/conversations/{conversationId}` |
| Fetch recording (MP3) | `GET` | `/v1/convai/conversations/{conversationId}/audio` |
| Hang up | `POST` | `/v1/convai/conversations/{conversationId}/end` |
| Hang up fallback | WebSocket | `wss://api.elevenlabs.io/v1/convai/conversations/{conversationId}/monitor` |

Monitor fallback sends `{ "command_type": "end_call" }`. Requires Monitoring enabled on the agent.

## Inbound webhook

ElevenLabs posts to our function (not an ElevenLabs list endpoint):

```
https://{PROJECT_REF}.supabase.co/functions/v1/elevenlabs-webhook
```

Verified with `ELEVENLABS_WEBHOOK_SECRET` and the `elevenlabs-signature` header (`t` + `v0`/`v1`, HMAC-SHA256 of `{timestamp}.{rawBody}`, max age 30 minutes).

Enable on the agent: post-call transcription, plus call initiation failure.

## Env

| Variable | Used for |
|---|---|
| `ELEVENLABS_API_KEY` | All API calls |
| `ELEVENLABS_AGENT_ID` | Outbound calls |
| `ELEVENLABS_AGENT_PHONE_NUMBER_ID` | Outbound calls |
| `ELEVENLABS_WEBHOOK_SECRET` | Inbound webhook verification |
| `ELEVENLABS_TELEPHONY_PROVIDER` | Outbound call path (`twilio` / `sip-trunk` / `exotel`) |
