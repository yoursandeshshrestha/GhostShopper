-- Call lifecycle fields for ElevenLabs integration + scorecard review.

alter table public.calls
  add column if not exists external_conversation_id text,
  add column if not exists external_call_sid text,
  add column if not exists transcript text,
  add column if not exists recording_url text,
  add column if not exists criterion_scores jsonb not null default '[]'::jsonb,
  add column if not exists failure_reason text;

create index if not exists calls_conversation_idx
  on public.calls (external_conversation_id)
  where external_conversation_id is not null;

create index if not exists calls_org_created_idx
  on public.calls (org_id, created_at desc);
