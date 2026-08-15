alter table public.calls
  add column if not exists call_summary text;
