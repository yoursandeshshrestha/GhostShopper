-- Coaches can manage agents (scenarios) and scorecards; locations stay admin-only.

drop policy if exists scorecards_insert on public.scorecards;
drop policy if exists scorecards_update on public.scorecards;
drop policy if exists scorecards_delete on public.scorecards;
drop policy if exists scenarios_insert on public.scenarios;
drop policy if exists scenarios_update on public.scenarios;
drop policy if exists scenarios_delete on public.scenarios;

create policy scorecards_insert on public.scorecards
  for insert to authenticated
  with check (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin', 'coach')
    )
  );

create policy scorecards_update on public.scorecards
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

create policy scorecards_delete on public.scorecards
  for delete to authenticated
  using (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin', 'coach')
    )
  );

create policy scenarios_insert on public.scenarios
  for insert to authenticated
  with check (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin', 'coach')
    )
  );

create policy scenarios_update on public.scenarios
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

create policy scenarios_delete on public.scenarios
  for delete to authenticated
  using (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin', 'coach')
    )
  );

create or replace function public.set_default_scenario(p_scenario_id uuid)
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

  if v_role not in ('owner', 'admin', 'coach', 'superadmin') then
    raise exception 'Only owners, admins, and coaches can change the default agent';
  end if;

  if not exists (
    select 1
    from public.scenarios
    where id = p_scenario_id
      and org_id = v_org_id
  ) then
    raise exception 'Agent not found';
  end if;

  update public.scenarios
  set is_default = false
  where org_id = v_org_id;

  update public.scenarios
  set is_default = true
  where id = p_scenario_id;
end;
$$;

create or replace function public.set_default_scorecard(p_scorecard_id uuid)
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

  if v_role not in ('owner', 'admin', 'coach', 'superadmin') then
    raise exception 'Only owners, admins, and coaches can change the default scorecard';
  end if;

  if not exists (
    select 1
    from public.scorecards
    where id = p_scorecard_id
      and org_id = v_org_id
  ) then
    raise exception 'Scorecard not found';
  end if;

  update public.scorecards
  set is_default = false
  where org_id = v_org_id;

  update public.scorecards
  set is_default = true
  where id = p_scorecard_id;
end;
$$;
