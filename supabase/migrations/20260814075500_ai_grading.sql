-- AI grading fields for auto-scored calls and the human review queue.

alter table public.calls
  add column if not exists transcript_json jsonb,
  add column if not exists flag_reasons text[] not null default '{}',
  add column if not exists flagged_for_review boolean not null default false,
  add column if not exists grader_model text,
  add column if not exists ai_graded_at timestamptz,
  add column if not exists human_reviewed boolean not null default false,
  add column if not exists suspected_ai boolean not null default false,
  add column if not exists coaching_summary text;

create index if not exists calls_flagged_review_idx
  on public.calls (org_id, created_at desc)
  where status = 'awaiting_review' and flagged_for_review = true;
