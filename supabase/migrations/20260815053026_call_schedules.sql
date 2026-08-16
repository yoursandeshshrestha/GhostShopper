-- Recurring and one-off mystery-shop call schedules.

do $$ begin
  create type public.call_schedule_kind as enum ('recurring', 'one_off');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.call_schedule_status as enum (
    'active',
    'paused',
    'cancelled',
    'completed'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.call_schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  scenario_id uuid references public.scenarios (id) on delete set null,
  scorecard_id uuid references public.scorecards (id) on delete set null,
  kind public.call_schedule_kind not null,
  status public.call_schedule_status not null default 'active',
  frequency text,
  timezone text not null default 'UTC',
  local_time time not null default '10:00',
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  last_call_id uuid references public.calls (id) on delete set null,
  claimed_until timestamptz,
  last_error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint call_schedules_frequency_check check (
    (
      kind = 'recurring'
      and frequency in ('Daily', 'Weekly', 'Bi-weekly', 'Monthly')
    )
    or (
      kind = 'one_off'
      and frequency is null
    )
  )
);

create index if not exists call_schedules_org_idx
  on public.call_schedules (org_id);

create index if not exists call_schedules_due_idx
  on public.call_schedules (status, next_run_at)
  where status = 'active';

create unique index if not exists call_schedules_one_recurring_per_location
  on public.call_schedules (location_id)
  where kind = 'recurring' and status in ('active', 'paused');

create trigger call_schedules_set_updated_at
before update on public.call_schedules
for each row execute function public.set_updated_at();

alter table public.calls
  add column if not exists schedule_id uuid references public.call_schedules (id)
    on delete set null;

create index if not exists calls_schedule_idx on public.calls (schedule_id);

alter table public.call_schedules enable row level security;

create policy call_schedules_select on public.call_schedules
  for select to authenticated
  using (public.is_superadmin() or org_id = public.current_org_id());

create policy call_schedules_insert on public.call_schedules
  for insert to authenticated
  with check (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin', 'coach')
    )
  );

create policy call_schedules_update on public.call_schedules
  for update to authenticated
  using (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin', 'coach')
    )
  )
  with check (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin', 'coach')
    )
  );

create policy call_schedules_delete on public.call_schedules
  for delete to authenticated
  using (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  );

create or replace function public.claim_due_call_schedules(
  p_limit integer default 10,
  p_org_id uuid default null
)
returns setof public.call_schedules
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select s.id
    from public.call_schedules s
    where s.status = 'active'
      and s.next_run_at <= now()
      and (s.claimed_until is null or s.claimed_until < now())
      and (p_org_id is null or s.org_id = p_org_id)
    order by s.next_run_at
    for update of s skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  )
  update public.call_schedules s
  set claimed_until = now() + interval '10 minutes'
  from due
  where s.id = due.id
  returning s.*;
end;
$$;

revoke all on function public.claim_due_call_schedules(integer, uuid) from public;
revoke all on function public.claim_due_call_schedules(integer, uuid) from anon, authenticated;
grant execute on function public.claim_due_call_schedules(integer, uuid) to service_role;

do $$
begin
  alter publication supabase_realtime add table public.call_schedules;
exception
  when duplicate_object then null;
end $$;
