-- First-time org setup wizard: flags, domain tables, progress, complete RPC.

alter table public.orgs
  add column if not exists setup_completed boolean not null default false,
  add column if not exists setup_step text not null default 'welcome';

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.orgs.setup_completed is 'True after owner finishes the post-attestation setup wizard';
comment on column public.orgs.setup_step is 'Current setup wizard step: welcome|locations|scorecard|scenario|team|review';
comment on column public.profiles.onboarding_completed_at is 'When this user finished org setup (owners) or first reached the app';

-- ---------------------------------------------------------------------------
-- Locations
-- ---------------------------------------------------------------------------
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  name text not null,
  phone text,
  timezone text,
  country text,
  call_frequency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists locations_org_idx on public.locations (org_id);

create trigger locations_set_updated_at
before update on public.locations
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Scorecards
-- ---------------------------------------------------------------------------
create table if not exists public.scorecards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  name text not null default 'Default Scorecard',
  criteria jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scorecards_criteria_is_array check (jsonb_typeof(criteria) = 'array')
);

create unique index if not exists scorecards_one_per_org_idx
  on public.scorecards (org_id);

create trigger scorecards_set_updated_at
before update on public.scorecards
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- AI scenarios
-- ---------------------------------------------------------------------------
create table if not exists public.scenarios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  prompt text not null default '',
  persona text,
  goals text,
  conversation_rules text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists scenarios_one_per_org_idx
  on public.scenarios (org_id);

create trigger scenarios_set_updated_at
before update on public.scenarios
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.locations enable row level security;
alter table public.scorecards enable row level security;
alter table public.scenarios enable row level security;

create policy locations_select on public.locations
  for select to authenticated
  using (public.is_superadmin() or org_id = public.current_org_id());

create policy locations_insert on public.locations
  for insert to authenticated
  with check (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  );

create policy locations_update on public.locations
  for update to authenticated
  using (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  )
  with check (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  );

create policy locations_delete on public.locations
  for delete to authenticated
  using (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  );

create policy scorecards_select on public.scorecards
  for select to authenticated
  using (public.is_superadmin() or org_id = public.current_org_id());

create policy scorecards_insert on public.scorecards
  for insert to authenticated
  with check (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  );

create policy scorecards_update on public.scorecards
  for update to authenticated
  using (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  )
  with check (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  );

create policy scorecards_delete on public.scorecards
  for delete to authenticated
  using (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  );

create policy scenarios_select on public.scenarios
  for select to authenticated
  using (public.is_superadmin() or org_id = public.current_org_id());

create policy scenarios_insert on public.scenarios
  for insert to authenticated
  with check (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  );

create policy scenarios_update on public.scenarios
  for update to authenticated
  using (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  )
  with check (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  );

create policy scenarios_delete on public.scenarios
  for delete to authenticated
  using (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Progress + finish RPCs
-- ---------------------------------------------------------------------------
create or replace function public.save_setup_step(next_step text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role public.profile_role;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select org_id, role into v_org_id, v_role
  from public.profiles
  where id = auth.uid();

  if v_org_id is null or v_role <> 'owner' then
    raise exception 'Only organisation owners can update setup progress';
  end if;

  if next_step not in (
    'welcome', 'locations', 'scorecard', 'scenario', 'team', 'review'
  ) then
    raise exception 'Invalid setup step';
  end if;

  update public.orgs
  set setup_step = next_step, updated_at = now()
  where id = v_org_id
    and setup_completed = false;
end;
$$;

create or replace function public.complete_org_setup()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role public.profile_role;
  v_location_count integer;
  v_scorecard_count integer;
  v_scenario_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select org_id, role into v_org_id, v_role
  from public.profiles
  where id = auth.uid();

  if v_org_id is null or v_role <> 'owner' then
    raise exception 'Only organisation owners can complete setup';
  end if;

  select count(*) into v_location_count
  from public.locations
  where org_id = v_org_id;

  if v_location_count < 1 then
    raise exception 'Add at least one location before finishing setup';
  end if;

  select count(*) into v_scorecard_count
  from public.scorecards
  where org_id = v_org_id;

  if v_scorecard_count < 1 then
    raise exception 'Create a scorecard before finishing setup';
  end if;

  select count(*) into v_scenario_count
  from public.scenarios
  where org_id = v_org_id
    and approved_at is not null;

  if v_scenario_count < 1 then
    raise exception 'Approve an AI scenario before finishing setup';
  end if;

  update public.orgs
  set
    setup_completed = true,
    setup_step = 'review',
    updated_at = now()
  where id = v_org_id;

  update public.profiles
  set
    onboarding_completed_at = coalesce(onboarding_completed_at, now()),
    updated_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.save_setup_step(text) from public;
revoke all on function public.complete_org_setup() from public;

grant execute on function public.save_setup_step(text) to authenticated;
grant execute on function public.complete_org_setup() to authenticated;
