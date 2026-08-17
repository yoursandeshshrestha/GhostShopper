#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.local}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy .env.example and fill in MAILGUN_* values."
  exit 1
fi

# Load selected keys from .env.local without executing arbitrary shell.
load_env_value() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    echo ""
    return
  fi
  local value="${line#*=}"
  # Strip surrounding quotes
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
if [[ -z "$PROJECT_REF" && -f supabase/.temp/project-ref ]]; then
  PROJECT_REF="$(tr -d '[:space:]' < supabase/.temp/project-ref)"
fi
if [[ -z "$PROJECT_REF" ]]; then
  SUPABASE_URL="$(load_env_value VITE_SUPABASE_URL)"
  if [[ "$SUPABASE_URL" =~ https://([a-z0-9]+)\.supabase\.co ]]; then
    PROJECT_REF="${BASH_REMATCH[1]}"
  fi
fi
if [[ -z "$PROJECT_REF" ]]; then
  echo "Could not determine Supabase project ref. Link the project or set SUPABASE_PROJECT_REF."
  exit 1
fi

MAILGUN_API_KEY="$(load_env_value MAILGUN_API_KEY)"
MAILGUN_DOMAIN="$(load_env_value MAILGUN_DOMAIN)"
MAILGUN_FROM_EMAIL="$(load_env_value MAILGUN_FROM_EMAIL)"
MAILGUN_API_BASE="$(load_env_value MAILGUN_API_BASE)"
APP_URL="$(load_env_value APP_URL)"
SEND_EMAIL_HOOK_SECRET="$(load_env_value SEND_EMAIL_HOOK_SECRET)"
ELEVENLABS_API_KEY="$(load_env_value ELEVENLABS_API_KEY)"
ELEVENLABS_AGENT_ID="$(load_env_value ELEVENLABS_AGENT_ID)"
ELEVENLABS_AGENT_PHONE_NUMBER_ID="$(load_env_value ELEVENLABS_AGENT_PHONE_NUMBER_ID)"
ELEVENLABS_WEBHOOK_SECRET="$(load_env_value ELEVENLABS_WEBHOOK_SECRET)"
ELEVENLABS_TELEPHONY_PROVIDER="$(load_env_value ELEVENLABS_TELEPHONY_PROVIDER)"
OPENROUTER_API_KEY="$(load_env_value OPENROUTER_API_KEY)"
OPENROUTER_MODEL="$(load_env_value OPENROUTER_MODEL)"
SCHEDULE_CRON_SECRET="$(load_env_value SCHEDULE_CRON_SECRET)"

if [[ -z "$MAILGUN_API_KEY" ]]; then
  echo "MAILGUN_API_KEY is missing in $ENV_FILE"
  exit 1
fi
if [[ -z "$MAILGUN_DOMAIN" ]]; then
  MAILGUN_DOMAIN="mail.ghostshopper.ai"
fi
if [[ -z "$MAILGUN_FROM_EMAIL" ]]; then
  MAILGUN_FROM_EMAIL="GhostShopper <noreply@mail.ghostshopper.ai>"
fi
if [[ -z "$MAILGUN_API_BASE" ]]; then
  MAILGUN_API_BASE="https://api.mailgun.net"
fi
if [[ -z "$APP_URL" ]]; then
  APP_URL="https://app.ghostshopper.ai"
fi

SECRETS_FILE="$(mktemp)"
trap 'rm -f "$SECRETS_FILE"' EXIT

{
  printf '%s\n' "MAILGUN_API_KEY=${MAILGUN_API_KEY}"
  printf '%s\n' "MAILGUN_DOMAIN=${MAILGUN_DOMAIN}"
  printf '%s\n' "MAILGUN_API_BASE=${MAILGUN_API_BASE}"
  # Quote values that contain spaces / angle brackets
  printf '%s\n' "MAILGUN_FROM_EMAIL=\"${MAILGUN_FROM_EMAIL}\""
  printf '%s\n' "APP_URL=${APP_URL}"
  if [[ -n "$SEND_EMAIL_HOOK_SECRET" ]]; then
    printf '%s\n' "SEND_EMAIL_HOOK_SECRET=${SEND_EMAIL_HOOK_SECRET}"
  fi
  if [[ -n "$ELEVENLABS_API_KEY" ]]; then
    printf '%s\n' "ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}"
  fi
  if [[ -n "$ELEVENLABS_AGENT_ID" ]]; then
    printf '%s\n' "ELEVENLABS_AGENT_ID=${ELEVENLABS_AGENT_ID}"
  fi
  if [[ -n "$ELEVENLABS_AGENT_PHONE_NUMBER_ID" ]]; then
    printf '%s\n' "ELEVENLABS_AGENT_PHONE_NUMBER_ID=${ELEVENLABS_AGENT_PHONE_NUMBER_ID}"
  fi
  if [[ -n "$ELEVENLABS_WEBHOOK_SECRET" ]]; then
    printf '%s\n' "ELEVENLABS_WEBHOOK_SECRET=${ELEVENLABS_WEBHOOK_SECRET}"
  fi
  if [[ -n "$ELEVENLABS_TELEPHONY_PROVIDER" ]]; then
    printf '%s\n' "ELEVENLABS_TELEPHONY_PROVIDER=${ELEVENLABS_TELEPHONY_PROVIDER}"
  fi
  if [[ -n "$OPENROUTER_API_KEY" ]]; then
    printf '%s\n' "OPENROUTER_API_KEY=${OPENROUTER_API_KEY}"
  fi
  if [[ -n "$OPENROUTER_MODEL" ]]; then
    printf '%s\n' "OPENROUTER_MODEL=${OPENROUTER_MODEL}"
  fi
  if [[ -n "$SCHEDULE_CRON_SECRET" ]]; then
    printf '%s\n' "SCHEDULE_CRON_SECRET=${SCHEDULE_CRON_SECRET}"
  fi
} > "$SECRETS_FILE"

echo "→ Setting Edge Function secrets on ${PROJECT_REF}"
supabase secrets set --env-file "$SECRETS_FILE" --project-ref "$PROJECT_REF"
# Drop the old Anthropic grader key if it is still present.
supabase secrets unset ANTHROPIC_API_KEY --project-ref "$PROJECT_REF" --yes >/dev/null 2>&1 || true

echo "→ Deploying Edge Functions to ${PROJECT_REF}"
if compgen -G "supabase/functions/*/index.ts" > /dev/null; then
  for fn_dir in supabase/functions/*/; do
    fn_name="$(basename "$fn_dir")"
    if [[ "$fn_name" == "_shared" ]]; then
      continue
    fi
    if [[ -f "${fn_dir}index.ts" || -f "${fn_dir}index.js" ]]; then
      echo "  • ${fn_name}"
      # Auth Send Email hook is called by Supabase Auth without a user JWT.
      if [[ "$fn_name" == "auth-send-email" || "$fn_name" == "elevenlabs-webhook" || "$fn_name" == "dispatch-scheduled-calls" ]]; then
        supabase functions deploy "$fn_name" --project-ref "$PROJECT_REF" --no-verify-jwt
      else
        supabase functions deploy "$fn_name" --project-ref "$PROJECT_REF"
      fi
    fi
  done
else
  echo "No functions found under supabase/functions"
  exit 1
fi

HOOK_URL="https://${PROJECT_REF}.supabase.co/functions/v1/auth-send-email"
ELEVENLABS_WEBHOOK_URL="https://${PROJECT_REF}.supabase.co/functions/v1/elevenlabs-webhook"

echo "✓ Functions and secrets deployed"
echo ""
echo "Auth emails (magic link, signup, recovery) via Mailgun:"
echo "  1. Open https://supabase.com/dashboard/project/${PROJECT_REF}/auth/hooks"
echo "  2. Enable Send Email hook (HTTPS)"
echo "  3. URL: ${HOOK_URL}"
echo "  4. Generate/paste secret into .env.local as SEND_EMAIL_HOOK_SECRET=v1,whsec_..."
echo "  5. Re-run: bun run function"
echo ""
echo "ElevenLabs post-call webhook (required for live call completion):"
echo "  1. Open ElevenLabs → Agents → your agent → Webhooks"
echo "  2. URL: ${ELEVENLABS_WEBHOOK_URL}"
echo "  3. Enable post_call_transcription and call_initiation_failure"
echo "  4. Copy the signing secret into .env.local as ELEVENLABS_WEBHOOK_SECRET"
echo "  5. Re-run: bun run function"
if [[ -z "$ELEVENLABS_WEBHOOK_SECRET" ]]; then
  echo ""
  echo "⚠ ELEVENLABS_WEBHOOK_SECRET is not set — live calls will not complete until the webhook is configured."
fi
if [[ -z "$SEND_EMAIL_HOOK_SECRET" ]]; then
  echo ""
  echo "⚠ SEND_EMAIL_HOOK_SECRET is not set yet — magic-link emails will stay on Supabase until the hook is configured."
fi
if [[ -z "$SCHEDULE_CRON_SECRET" ]]; then
  echo ""
  echo "⚠ SCHEDULE_CRON_SECRET is not set — automatic scheduled calls will not dial."
  echo "  Run: bash scripts/setup-schedule-cron.sh"
fi
if [[ -z "$OPENROUTER_API_KEY" ]]; then
  echo ""
  echo "⚠ OPENROUTER_API_KEY is not set — call scoring and scenario generation will use the mock grader."
fi
echo ""
echo "Scheduled calls (pg_cron every minute):"
echo "  bash scripts/setup-schedule-cron.sh"
echo "  Job: https://supabase.com/dashboard/project/${PROJECT_REF}/integrations/cron/jobs"
echo ""
