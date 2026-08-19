-- Platform usage metering for superadmin spend visibility.

alter table public.calls
  add column if not exists duration_secs integer;

comment on column public.calls.duration_secs is
  'Connected call duration from ElevenLabs webhook metadata.';

create table if not exists public.platform_pricing (
  id smallint primary key default 1 check (id = 1),
  voice_usd_per_minute numeric(12, 6) not null default 0.10,
  updated_at timestamptz not null default now()
);

insert into public.platform_pricing (id, voice_usd_per_minute)
values (1, 0.10)
on conflict (id) do nothing;

create trigger platform_pricing_set_updated_at
before update on public.platform_pricing
for each row execute function public.set_updated_at();

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  service text not null check (service in ('openrouter', 'elevenlabs')),
  operation text not null check (
    operation in ('voice_call', 'call_grade', 'scenario_gen')
  ),
  resource_id uuid,
  units jsonb not null default '{}'::jsonb,
  cost_usd numeric(12, 6) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_org_created_idx
  on public.usage_events (org_id, created_at desc);

create index if not exists usage_events_operation_created_idx
  on public.usage_events (operation, created_at desc);

create index if not exists usage_events_created_idx
  on public.usage_events (created_at desc);

alter table public.platform_pricing enable row level security;
alter table public.usage_events enable row level security;

create policy platform_pricing_select on public.platform_pricing
  for select to authenticated
  using (public.is_superadmin());

create policy platform_pricing_update on public.platform_pricing
  for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy usage_events_select on public.usage_events
  for select to authenticated
  using (public.is_superadmin());

-- Edge functions insert via service role (bypasses RLS).

create or replace function public.get_platform_usage_summary(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  operation text,
  event_count bigint,
  total_cost_usd numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ue.operation,
    count(*)::bigint as event_count,
    coalesce(sum(ue.cost_usd), 0)::numeric as total_cost_usd
  from public.usage_events ue
  where public.is_superadmin()
    and (p_from is null or ue.created_at >= p_from)
    and (p_to is null or ue.created_at <= p_to)
  group by ue.operation
  order by ue.operation;
$$;

create or replace function public.get_platform_usage_by_org(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  org_id uuid,
  org_name text,
  voice_call_cost numeric,
  call_grade_cost numeric,
  scenario_gen_cost numeric,
  total_cost_usd numeric,
  event_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id as org_id,
    o.name as org_name,
    coalesce(sum(ue.cost_usd) filter (where ue.operation = 'voice_call'), 0)::numeric
      as voice_call_cost,
    coalesce(sum(ue.cost_usd) filter (where ue.operation = 'call_grade'), 0)::numeric
      as call_grade_cost,
    coalesce(sum(ue.cost_usd) filter (where ue.operation = 'scenario_gen'), 0)::numeric
      as scenario_gen_cost,
    coalesce(sum(ue.cost_usd), 0)::numeric as total_cost_usd,
    count(ue.id)::bigint as event_count
  from public.orgs o
  left join public.usage_events ue
    on ue.org_id = o.id
    and (p_from is null or ue.created_at >= p_from)
    and (p_to is null or ue.created_at <= p_to)
  where public.is_superadmin()
  group by o.id, o.name
  having count(ue.id) > 0
  order by total_cost_usd desc, o.name;
$$;

create or replace function public.get_org_usage_summary(
  p_org_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  operation text,
  event_count bigint,
  total_cost_usd numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ue.operation,
    count(*)::bigint as event_count,
    coalesce(sum(ue.cost_usd), 0)::numeric as total_cost_usd
  from public.usage_events ue
  where public.is_superadmin()
    and ue.org_id = p_org_id
    and (p_from is null or ue.created_at >= p_from)
    and (p_to is null or ue.created_at <= p_to)
  group by ue.operation
  order by ue.operation;
$$;

grant execute on function public.get_platform_usage_summary(timestamptz, timestamptz)
  to authenticated;
grant execute on function public.get_platform_usage_by_org(timestamptz, timestamptz)
  to authenticated;
grant execute on function public.get_org_usage_summary(uuid, timestamptz, timestamptz)
  to authenticated;
