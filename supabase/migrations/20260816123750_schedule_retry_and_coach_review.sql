-- Retry delay after miss / busy / voicemail, chosen when creating a schedule.
alter table public.call_schedules
  add column if not exists retry_after_minutes integer;

alter table public.call_schedules
  add column if not exists retry_count integer not null default 0;

alter table public.call_schedules
  add column if not exists max_retries integer not null default 2;

alter table public.call_schedules
  add column if not exists last_settled_call_id uuid;

do $$ begin
  alter table public.call_schedules
    add constraint call_schedules_retry_after_minutes_check
    check (
      retry_after_minutes is null
      or retry_after_minutes >= 0
    );
exception
  when duplicate_object then null;
end $$;
