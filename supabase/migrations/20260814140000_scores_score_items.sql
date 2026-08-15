-- Normalized scores + score_items (PRD). Keeps calls.criterion_scores in sync for reads.

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  scorecard_id uuid references public.scorecards (id) on delete set null,
  total numeric(5, 2) not null default 0,
  grader_model text,
  suspected_ai boolean not null default false,
  human_reviewed boolean not null default false,
  flagged_for_review boolean not null default false,
  flag_reasons text[] not null default '{}',
  call_summary text,
  coaching_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scores_call_id_unique unique (call_id)
);

create index if not exists scores_org_id_idx on public.scores (org_id);
create index if not exists scores_call_id_idx on public.scores (call_id);

create table if not exists public.score_items (
  id uuid primary key default gen_random_uuid(),
  score_id uuid not null references public.scores (id) on delete cascade,
  criterion_id text not null,
  criterion_name text not null,
  weight numeric(5, 2) not null default 0,
  score numeric(5, 2) not null default 0,
  confidence numeric(4, 3),
  evidence_quote text,
  transcript_offset integer,
  source text not null default 'ai' check (source in ('ai', 'human')),
  created_at timestamptz not null default now()
);

create index if not exists score_items_score_id_idx on public.score_items (score_id);

create trigger scores_set_updated_at
before update on public.scores
for each row execute function public.set_updated_at();

alter table public.scores enable row level security;
alter table public.score_items enable row level security;

create policy scores_select on public.scores
  for select to authenticated
  using (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and (
        public.current_profile_role() <> 'location_viewer'
        or exists (
          select 1
          from public.calls c
          where c.id = scores.call_id
            and c.location_id = (
              select assigned_location_id
              from public.profiles
              where id = auth.uid()
            )
        )
      )
    )
  );

create policy score_items_select on public.score_items
  for select to authenticated
  using (
    public.is_superadmin()
    or exists (
      select 1
      from public.scores s
      where s.id = score_items.score_id
        and s.org_id = public.current_org_id()
    )
  );

-- Backfill from existing calls
insert into public.scores (
  call_id,
  org_id,
  scorecard_id,
  total,
  grader_model,
  suspected_ai,
  human_reviewed,
  flagged_for_review,
  flag_reasons,
  call_summary,
  coaching_summary,
  created_at,
  updated_at
)
select
  c.id,
  c.org_id,
  c.scorecard_id,
  coalesce(c.score, 0),
  c.grader_model,
  coalesce(c.suspected_ai, false),
  coalesce(c.human_reviewed, false),
  coalesce(c.flagged_for_review, false),
  coalesce(c.flag_reasons, '{}'),
  c.call_summary,
  c.coaching_summary,
  coalesce(c.completed_at, c.created_at),
  coalesce(c.completed_at, c.created_at)
from public.calls c
where c.score is not null
   or jsonb_array_length(coalesce(c.criterion_scores, '[]'::jsonb)) > 0
on conflict (call_id) do nothing;

insert into public.score_items (
  score_id,
  criterion_id,
  criterion_name,
  weight,
  score,
  confidence,
  evidence_quote,
  transcript_offset,
  source
)
select
  s.id,
  item->>'criterionId',
  coalesce(item->>'criterionName', item->>'criterionId'),
  coalesce((item->>'weight')::numeric, 0),
  coalesce((item->>'score')::numeric, 0),
  nullif(item->>'confidence', '')::numeric,
  nullif(item->>'evidenceQuote', ''),
  nullif(item->>'transcriptOffset', '')::integer,
  coalesce(item->>'source', 'ai')
from public.scores s
join public.calls c on c.id = s.call_id
cross join lateral jsonb_array_elements(coalesce(c.criterion_scores, '[]'::jsonb)) as item
where not exists (
  select 1 from public.score_items si where si.score_id = s.id
);

create or replace function public.upsert_call_score(
  p_call_id uuid,
  p_criterion_scores jsonb,
  p_total numeric,
  p_grader_model text default null,
  p_suspected_ai boolean default false,
  p_human_reviewed boolean default false,
  p_flagged_for_review boolean default false,
  p_flag_reasons text[] default '{}',
  p_call_summary text default null,
  p_coaching_summary text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_scorecard_id uuid;
  v_role public.profile_role;
  v_score_id uuid;
  item jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select c.org_id, c.scorecard_id into v_org_id, v_scorecard_id
  from public.calls c
  where c.id = p_call_id;

  if v_org_id is null then
    raise exception 'Call not found';
  end if;

  select role into v_role from public.profiles where id = auth.uid();

  if v_role not in ('owner', 'admin', 'coach', 'superadmin') then
    raise exception 'Not allowed to save scores';
  end if;

  if v_role <> 'superadmin' and v_org_id <> public.current_org_id() then
    raise exception 'Call not in your organisation';
  end if;

  insert into public.scores (
    call_id,
    org_id,
    scorecard_id,
    total,
    grader_model,
    suspected_ai,
    human_reviewed,
    flagged_for_review,
    flag_reasons,
    call_summary,
    coaching_summary
  )
  values (
    p_call_id,
    v_org_id,
    v_scorecard_id,
    coalesce(p_total, 0),
    p_grader_model,
    coalesce(p_suspected_ai, false),
    coalesce(p_human_reviewed, false),
    coalesce(p_flagged_for_review, false),
    coalesce(p_flag_reasons, '{}'),
    p_call_summary,
    p_coaching_summary
  )
  on conflict (call_id) do update set
    total = excluded.total,
    grader_model = coalesce(excluded.grader_model, public.scores.grader_model),
    suspected_ai = excluded.suspected_ai,
    human_reviewed = excluded.human_reviewed,
    flagged_for_review = excluded.flagged_for_review,
    flag_reasons = excluded.flag_reasons,
    call_summary = coalesce(excluded.call_summary, public.scores.call_summary),
    coaching_summary = coalesce(excluded.coaching_summary, public.scores.coaching_summary),
    updated_at = now()
  returning id into v_score_id;

  delete from public.score_items where score_id = v_score_id;

  for item in select * from jsonb_array_elements(coalesce(p_criterion_scores, '[]'::jsonb))
  loop
    insert into public.score_items (
      score_id,
      criterion_id,
      criterion_name,
      weight,
      score,
      confidence,
      evidence_quote,
      transcript_offset,
      source
    )
    values (
      v_score_id,
      item->>'criterionId',
      coalesce(item->>'criterionName', item->>'criterionId'),
      coalesce((item->>'weight')::numeric, 0),
      coalesce((item->>'score')::numeric, 0),
      nullif(item->>'confidence', '')::numeric,
      nullif(item->>'evidenceQuote', ''),
      nullif(item->>'transcriptOffset', '')::integer,
      coalesce(item->>'source', 'ai')
    );
  end loop;

  return v_score_id;
end;
$$;

grant execute on function public.upsert_call_score(
  uuid, jsonb, numeric, text, boolean, boolean, boolean, text[], text, text
) to authenticated;
