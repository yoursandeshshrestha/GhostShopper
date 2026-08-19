-- Debug metadata for failed calls (ElevenLabs webhook payload, API errors, etc.).

alter table public.calls
  add column if not exists failure_metadata jsonb;

comment on column public.calls.failure_metadata is
  'Structured failure debug info (raw provider reason, webhook payload). Shown to superadmins only.';
