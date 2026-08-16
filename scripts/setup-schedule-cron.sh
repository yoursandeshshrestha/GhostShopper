#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.local}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy .env.example and fill in project values."
  exit 1
fi

load_env_value() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    echo ""
    return
  fi
  local value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

ensure_cron_secret() {
  local existing
  existing="$(load_env_value SCHEDULE_CRON_SECRET)"
  if [[ -n "$existing" ]]; then
    printf '%s' "$existing"
    return
  fi

  local generated
  generated="$(openssl rand -hex 32)"
  printf '\nSCHEDULE_CRON_SECRET=%s\n' "$generated" >> "$ENV_FILE"
  printf '%s' "$generated"
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
  echo "Could not determine Supabase project ref."
  exit 1
fi

PROJECT_URL="https://${PROJECT_REF}.supabase.co"
CRON_SECRET="$(ensure_cron_secret)"

echo "→ Setting SCHEDULE_CRON_SECRET on ${PROJECT_REF}"
supabase secrets set "SCHEDULE_CRON_SECRET=${CRON_SECRET}" --project-ref "$PROJECT_REF"

SQL="$(cat <<EOF
do \$setup\$
declare
  url_id uuid;
  secret_id uuid;
  project_url text := '${PROJECT_URL}';
  cron_secret text := '${CRON_SECRET}';
begin
  select id into url_id from vault.secrets where name = 'project_url';
  if url_id is null then
    perform vault.create_secret(project_url, 'project_url', 'GhostShopper project URL for schedule cron');
  else
    perform vault.update_secret(url_id, project_url);
  end if;

  select id into secret_id from vault.secrets where name = 'schedule_cron_secret';
  if secret_id is null then
    perform vault.create_secret(cron_secret, 'schedule_cron_secret', 'Auth header for dispatch-scheduled-calls');
  else
    perform vault.update_secret(secret_id, cron_secret);
  end if;
end;
\$setup\$;

select jobid, jobname, schedule, active
from cron.job
where jobname = 'dispatch-scheduled-calls';
EOF
)"

echo "→ Storing vault secrets and checking cron job"
if supabase db query --linked "$SQL" >/tmp/ghostshopper-cron-setup.out 2>/tmp/ghostshopper-cron-setup.err; then
  cat /tmp/ghostshopper-cron-setup.out
  rm -f /tmp/ghostshopper-cron-setup.out /tmp/ghostshopper-cron-setup.err
  echo "✓ Schedule cron is configured. Due calls dial within about a minute."
  exit 0
fi

if bunx --bun supabase@2.114.0 db query --linked "$SQL" >/tmp/ghostshopper-cron-setup.out 2>/tmp/ghostshopper-cron-setup.err; then
  cat /tmp/ghostshopper-cron-setup.out
  rm -f /tmp/ghostshopper-cron-setup.out /tmp/ghostshopper-cron-setup.err
  echo "✓ Schedule cron is configured. Due calls dial within about a minute."
  exit 0
fi

echo "Could not run SQL via CLI. Open the SQL editor and paste the vault upsert from scripts/setup-schedule-cron.sh."
echo "Cron job migration should already be applied; vault secrets are still required."
cat /tmp/ghostshopper-cron-setup.err >&2 || true
exit 1
