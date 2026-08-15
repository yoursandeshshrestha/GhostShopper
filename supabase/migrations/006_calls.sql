-- Calls domain for New call + Review pages.

do $$ begin
  create type public.call_status as enum (
    'queued',
    'in_progress',
    'analysing',
    'completed',
    'failed',
    'missed',
    'awaiting_review'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  scenario_id uuid references public.scenarios (id) on delete set null,
  status public.call_status not null default 'queued',
  score numeric(5, 2),
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calls_org_idx on public.calls (org_id);
create index if not exists calls_location_idx on public.calls (location_id);
create index if not exists calls_status_idx on public.calls (org_id, status);

create trigger calls_set_updated_at
before update on public.calls
for each row execute function public.set_updated_at();

alter table public.calls enable row level security;

create policy calls_select on public.calls
  for select to authenticated
  using (public.is_superadmin() or org_id = public.current_org_id());

create policy calls_insert on public.calls
  for insert to authenticated
  with check (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin', 'coach')
    )
  );

create policy calls_update on public.calls
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

create policy calls_delete on public.calls
  for delete to authenticated
  using (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  );
