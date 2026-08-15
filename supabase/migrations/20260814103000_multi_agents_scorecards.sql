-- Allow multiple AI agents (scenarios) and scorecards per org.

drop index if exists public.scorecards_one_per_org_idx;
drop index if exists public.scenarios_one_per_org_idx;

alter table public.scenarios
  add column if not exists name text;

alter table public.scorecards
  add column if not exists is_default boolean not null default false;

alter table public.scenarios
  add column if not exists is_default boolean not null default false;

alter table public.calls
  add column if not exists scorecard_id uuid references public.scorecards (id) on delete set null;

create index if not exists calls_scorecard_idx on public.calls (scorecard_id)
  where scorecard_id is not null;

create index if not exists scorecards_org_created_idx
  on public.scorecards (org_id, created_at desc);

create index if not exists scenarios_org_created_idx
  on public.scenarios (org_id, created_at desc);

-- Backfill agent names from prompt snippet
update public.scenarios
set name = coalesce(
  nullif(trim(left(prompt, 64)), ''),
  'Default agent'
)
where name is null or trim(name) = '';

alter table public.scenarios
  alter column name set default 'Untitled agent',
  alter column name set not null;

-- Mark earliest row per org as default when none set
with ranked_scorecards as (
  select
    id,
    row_number() over (
      partition by org_id
      order by created_at asc
    ) as row_num
  from public.scorecards
)
update public.scorecards s
set is_default = true
from ranked_scorecards r
where s.id = r.id
  and r.row_num = 1
  and not exists (
    select 1
    from public.scorecards existing
    where existing.org_id = s.org_id
      and existing.is_default = true
      and existing.id <> s.id
  );

with ranked_scenarios as (
  select
    id,
    row_number() over (
      partition by org_id
      order by created_at asc
    ) as row_num
  from public.scenarios
)
update public.scenarios s
set is_default = true
from ranked_scenarios r
where s.id = r.id
  and r.row_num = 1
  and not exists (
    select 1
    from public.scenarios existing
    where existing.org_id = s.org_id
      and existing.is_default = true
      and existing.id <> s.id
  );

-- Attach existing calls to org default scorecard where missing
update public.calls c
set scorecard_id = sc.id
from public.scorecards sc
where c.scorecard_id is null
  and sc.org_id = c.org_id
  and sc.is_default = true;
