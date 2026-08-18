-- Organisation and user suspension, superadmin org provisioning.

alter table public.orgs
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references auth.users (id) on delete set null;

alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references auth.users (id) on delete set null;

create index if not exists orgs_suspended_at_idx
  on public.orgs (suspended_at)
  where suspended_at is not null;

create index if not exists profiles_suspended_at_idx
  on public.profiles (suspended_at)
  where suspended_at is not null;

-- Block org-scoped access when the user or their org is suspended.
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'superadmin'
      and suspended_at is null
  )
$$;

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.org_id
  from public.profiles p
  left join public.orgs o on o.id = p.org_id
  where p.id = auth.uid()
    and p.suspended_at is null
    and (p.org_id is null or o.suspended_at is null)
$$;

create or replace function public.create_org_as_superadmin(
  org_name text,
  org_industry text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_superadmin() then
    raise exception 'Only platform superadmins can create organisations';
  end if;

  if nullif(trim(org_name), '') is null then
    raise exception 'Organisation name is required';
  end if;

  insert into public.orgs (name, industry)
  values (trim(org_name), nullif(trim(org_industry), ''))
  returning id into v_org_id;

  return v_org_id;
end;
$$;

create or replace function public.create_org_invitation(
  p_org_id uuid,
  invite_email text,
  invite_role public.org_role default 'owner'
)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_invite public.invitations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_superadmin() then
    raise exception 'Only platform superadmins can invite users to an organisation';
  end if;

  if not exists (select 1 from public.orgs where id = p_org_id) then
    raise exception 'Organisation not found';
  end if;

  if exists (
    select 1 from public.orgs where id = p_org_id and suspended_at is not null
  ) then
    raise exception 'Cannot invite users to a suspended organisation';
  end if;

  v_email := lower(trim(invite_email));
  if v_email = '' or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'A valid email is required';
  end if;

  if invite_role = 'location_viewer' then
    raise exception 'Use the team page to invite location viewers';
  end if;

  insert into public.invitations (
    org_id,
    email,
    role,
    token,
    expires_at
  )
  values (
    p_org_id,
    v_email,
    invite_role,
    encode(extensions.gen_random_bytes(32), 'hex'),
    now() + interval '7 days'
  )
  returning * into v_invite;

  return v_invite;
end;
$$;

create or replace function public.suspend_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_superadmin() then
    raise exception 'Only platform superadmins can suspend organisations';
  end if;

  if not exists (select 1 from public.orgs where id = p_org_id) then
    raise exception 'Organisation not found';
  end if;

  update public.orgs
  set
    suspended_at = now(),
    suspended_by = auth.uid(),
    updated_at = now()
  where id = p_org_id
    and suspended_at is null;
end;
$$;

create or replace function public.unsuspend_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_superadmin() then
    raise exception 'Only platform superadmins can unsuspend organisations';
  end if;

  update public.orgs
  set
    suspended_at = null,
    suspended_by = null,
    updated_at = now()
  where id = p_org_id;
end;
$$;

create or replace function public.delete_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_superadmin() then
    raise exception 'Only platform superadmins can delete organisations';
  end if;

  if not exists (select 1 from public.orgs where id = p_org_id) then
    raise exception 'Organisation not found';
  end if;

  delete from public.orgs where id = p_org_id;
end;
$$;

create or replace function public.suspend_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_org_id uuid;
  v_caller_role public.profile_role;
  v_member public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot suspend yourself';
  end if;

  select org_id, role into v_caller_org_id, v_caller_role
  from public.profiles
  where id = auth.uid();

  select * into v_member
  from public.profiles
  where id = p_user_id;

  if v_member.id is null then
    raise exception 'User not found';
  end if;

  if v_member.role = 'superadmin' then
    raise exception 'Cannot suspend a platform superadmin';
  end if;

  if v_member.role = 'owner' then
    raise exception 'Cannot suspend the organisation owner';
  end if;

  if v_caller_role = 'superadmin' then
    null;
  elsif v_caller_role in ('owner', 'admin')
    and v_member.org_id = v_caller_org_id then
    null;
  else
    raise exception 'Only owners and admins can suspend team members';
  end if;

  update public.profiles
  set
    suspended_at = now(),
    suspended_by = auth.uid(),
    updated_at = now()
  where id = p_user_id
    and suspended_at is null;
end;
$$;

create or replace function public.unsuspend_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_org_id uuid;
  v_caller_role public.profile_role;
  v_member public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select org_id, role into v_caller_org_id, v_caller_role
  from public.profiles
  where id = auth.uid();

  select * into v_member
  from public.profiles
  where id = p_user_id;

  if v_member.id is null then
    raise exception 'User not found';
  end if;

  if v_caller_role = 'superadmin' then
    null;
  elsif v_caller_role in ('owner', 'admin')
    and v_member.org_id = v_caller_org_id then
    null;
  else
    raise exception 'Only owners and admins can unsuspend team members';
  end if;

  update public.profiles
  set
    suspended_at = null,
    suspended_by = null,
    updated_at = now()
  where id = p_user_id;
end;
$$;

-- Block joining suspended organisations.
create or replace function public.claim_pending_invitation(
  acceptor_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invitations;
  v_platform public.platform_invitations;
  v_email text;
  v_existing public.profiles;
  v_full_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then
    raise exception 'Authenticated user has no email';
  end if;

  v_full_name := nullif(trim(acceptor_full_name), '');

  select * into v_existing
  from public.profiles
  where id = auth.uid();

  if v_existing.id is not null then
    return v_existing.org_id;
  end if;

  select *
  into v_invite
  from public.invitations
  where lower(email) = v_email
    and accepted_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if v_invite.id is not null then
    if exists (
      select 1 from public.orgs
      where id = v_invite.org_id and suspended_at is not null
    ) then
      raise exception 'This organisation has been suspended. Contact your administrator.';
    end if;

    insert into public.profiles (
      id,
      org_id,
      email,
      full_name,
      role,
      assigned_location_id
    )
    values (
      auth.uid(),
      v_invite.org_id,
      v_email,
      v_full_name,
      v_invite.role::text::public.profile_role,
      v_invite.assigned_location_id
    );

    update public.invitations
    set accepted_at = now()
    where id = v_invite.id
       or (
         lower(email) = v_email
         and accepted_at is null
         and org_id = v_invite.org_id
       );

    return v_invite.org_id;
  end if;

  select *
  into v_platform
  from public.platform_invitations
  where lower(email) = v_email
    and accepted_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if v_platform.id is null then
    return null;
  end if;

  insert into public.profiles (
    id,
    org_id,
    email,
    full_name,
    role
  )
  values (
    auth.uid(),
    null,
    v_email,
    v_full_name,
    'superadmin'
  );

  update public.platform_invitations
  set accepted_at = now()
  where id = v_platform.id;

  return null;
end;
$$;

create or replace function public.accept_invitation(
  invite_token text,
  acceptor_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invitations;
  v_platform public.platform_invitations;
  v_email text;
  v_existing public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then
    raise exception 'Authenticated user has no email';
  end if;

  select * into v_invite
  from public.invitations
  where token = invite_token
  for update;

  if v_invite.id is not null then
    if exists (
      select 1 from public.orgs
      where id = v_invite.org_id and suspended_at is not null
    ) then
      raise exception 'This organisation has been suspended. Contact your administrator.';
    end if;

    if exists (select 1 from public.profiles where id = auth.uid()) then
      raise exception 'Profile already exists';
    end if;

    if v_invite.accepted_at is not null then
      raise exception 'Invitation already accepted';
    end if;

    if v_invite.expires_at < now() then
      raise exception 'Invitation has expired';
    end if;

    if lower(v_invite.email) <> v_email then
      raise exception 'Invitation email does not match signed-in user';
    end if;

    insert into public.profiles (
      id,
      org_id,
      email,
      full_name,
      role,
      assigned_location_id
    )
    values (
      auth.uid(),
      v_invite.org_id,
      v_email,
      nullif(trim(acceptor_full_name), ''),
      v_invite.role::text::public.profile_role,
      v_invite.assigned_location_id
    );

    update public.invitations
    set accepted_at = now()
    where id = v_invite.id;

    return v_invite.org_id;
  end if;

  select * into v_platform
  from public.platform_invitations
  where token = invite_token
  for update;

  if v_platform.id is null then
    raise exception 'Invitation not found';
  end if;

  if v_platform.accepted_at is not null then
    raise exception 'Invitation already accepted';
  end if;

  if v_platform.expires_at < now() then
    raise exception 'Invitation has expired';
  end if;

  if lower(v_platform.email) <> v_email then
    raise exception 'Invitation email does not match signed-in user';
  end if;

  select * into v_existing
  from public.profiles
  where id = auth.uid();

  if v_existing.id is not null then
    if v_existing.role = 'superadmin' then
      update public.platform_invitations
      set accepted_at = now()
      where id = v_platform.id;
      return null;
    end if;
    raise exception 'This account already belongs to an organisation';
  end if;

  insert into public.profiles (
    id,
    org_id,
    email,
    full_name,
    role
  )
  values (
    auth.uid(),
    null,
    v_email,
    nullif(trim(acceptor_full_name), ''),
    'superadmin'
  );

  update public.platform_invitations
  set accepted_at = now()
  where id = v_platform.id;

  return null;
end;
$$;

revoke all on function public.create_org_as_superadmin(text, text) from public;
revoke all on function public.create_org_invitation(uuid, text, public.org_role) from public;
revoke all on function public.suspend_org(uuid) from public;
revoke all on function public.unsuspend_org(uuid) from public;
revoke all on function public.delete_org(uuid) from public;
revoke all on function public.suspend_user(uuid) from public;
revoke all on function public.unsuspend_user(uuid) from public;

grant execute on function public.create_org_as_superadmin(text, text) to authenticated;
grant execute on function public.create_org_invitation(uuid, text, public.org_role) to authenticated;
grant execute on function public.suspend_org(uuid) to authenticated;
grant execute on function public.unsuspend_org(uuid) to authenticated;
grant execute on function public.delete_org(uuid) to authenticated;
grant execute on function public.suspend_user(uuid) to authenticated;
grant execute on function public.unsuspend_user(uuid) to authenticated;
