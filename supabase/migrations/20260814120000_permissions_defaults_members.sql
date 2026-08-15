-- Location viewer RLS scoping, default agent/scorecard RPCs, team member management.

drop policy if exists calls_select on public.calls;
drop policy if exists locations_select on public.locations;

create policy calls_select on public.calls
  for select to authenticated
  using (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and (
        public.current_profile_role() <> 'location_viewer'
        or location_id = (
          select assigned_location_id
          from public.profiles
          where id = auth.uid()
        )
      )
    )
  );

create policy locations_select on public.locations
  for select to authenticated
  using (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and (
        public.current_profile_role() <> 'location_viewer'
        or id = (
          select assigned_location_id
          from public.profiles
          where id = auth.uid()
        )
      )
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

  if v_role not in ('owner', 'admin', 'superadmin') then
    raise exception 'Only owners and admins can change the default agent';
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

  if v_role not in ('owner', 'admin', 'superadmin') then
    raise exception 'Only owners and admins can change the default scorecard';
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

create or replace function public.update_member_role(
  p_member_id uuid,
  p_role public.org_role,
  p_assigned_location_id uuid default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role public.profile_role;
  v_member public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select org_id, role into v_org_id, v_role
  from public.profiles
  where id = auth.uid();

  if v_role not in ('owner', 'admin', 'superadmin') then
    raise exception 'Only owners and admins can change member roles';
  end if;

  select * into v_member
  from public.profiles
  where id = p_member_id
    and org_id = v_org_id;

  if v_member.id is null then
    raise exception 'Member not found';
  end if;

  if v_member.role = 'owner' then
    raise exception 'Cannot change the owner role';
  end if;

  if p_role = 'owner' then
    raise exception 'Use ownership transfer to assign owner';
  end if;

  if p_role = 'location_viewer' and p_assigned_location_id is null then
    raise exception 'Location viewers need an assigned location';
  end if;

  if p_role = 'location_viewer' and not exists (
    select 1
    from public.locations
    where id = p_assigned_location_id
      and org_id = v_org_id
  ) then
    raise exception 'Assigned location not found';
  end if;

  update public.profiles
  set
    role = p_role,
    assigned_location_id = case
      when p_role = 'location_viewer' then p_assigned_location_id
      else null
    end
  where id = p_member_id
  returning * into v_member;

  return v_member;
end;
$$;

create or replace function public.remove_org_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role public.profile_role;
  v_member public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_member_id = auth.uid() then
    raise exception 'You cannot remove yourself';
  end if;

  select org_id, role into v_org_id, v_role
  from public.profiles
  where id = auth.uid();

  if v_role not in ('owner', 'admin', 'superadmin') then
    raise exception 'Only owners and admins can remove members';
  end if;

  select * into v_member
  from public.profiles
  where id = p_member_id
    and org_id = v_org_id;

  if v_member.id is null then
    raise exception 'Member not found';
  end if;

  if v_member.role = 'owner' then
    raise exception 'Cannot remove the owner';
  end if;

  delete from public.profiles
  where id = p_member_id;
end;
$$;

revoke all on function public.set_default_scenario(uuid) from public;
revoke all on function public.set_default_scorecard(uuid) from public;
revoke all on function public.update_member_role(uuid, public.org_role, uuid) from public;
revoke all on function public.remove_org_member(uuid) from public;

grant execute on function public.set_default_scenario(uuid) to authenticated;
grant execute on function public.set_default_scorecard(uuid) to authenticated;
grant execute on function public.update_member_role(uuid, public.org_role, uuid) to authenticated;
grant execute on function public.remove_org_member(uuid) to authenticated;
