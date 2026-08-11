-- Onboarding + invitation RPCs (SECURITY DEFINER).

create extension if not exists pgcrypto with schema extensions;

create or replace function public.create_org_with_owner(
  org_name text,
  org_industry text default null,
  owner_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Profile already exists';
  end if;

  v_email := coalesce(auth.jwt() ->> 'email', '');
  if v_email = '' then
    raise exception 'Authenticated user has no email';
  end if;

  if nullif(trim(org_name), '') is null then
    raise exception 'Organisation name is required';
  end if;

  insert into public.orgs (name, industry)
  values (trim(org_name), nullif(trim(org_industry), ''))
  returning id into v_org_id;

  insert into public.profiles (id, org_id, email, full_name, role)
  values (
    auth.uid(),
    v_org_id,
    v_email,
    nullif(trim(owner_full_name), ''),
    'owner'
  );

  return v_org_id;
end;
$$;

create or replace function public.sign_org_attestation(
  signed_by text,
  job_title text default null
)
returns void
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

  select org_id into v_org_id
  from public.profiles
  where id = auth.uid() and role = 'owner';

  if v_org_id is null then
    raise exception 'Only organisation owners can sign attestation';
  end if;

  if nullif(trim(signed_by), '') is null then
    raise exception 'Signature name is required';
  end if;

  update public.orgs
  set
    attestation_signed_by = trim(signed_by)
      || case
        when nullif(trim(job_title), '') is null then ''
        else ' (' || trim(job_title) || ')'
      end,
    attestation_signed_at = now(),
    updated_at = now()
  where id = v_org_id;
end;
$$;

create or replace function public.create_invitation(
  invite_email text,
  invite_role public.org_role,
  invite_location_id uuid default null
)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role public.profile_role;
  v_invite public.invitations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select org_id, role into v_org_id, v_role
  from public.profiles
  where id = auth.uid();

  if v_org_id is null or v_role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can invite users';
  end if;

  if invite_role = 'location_viewer' and invite_location_id is null then
    raise exception 'Location Viewer invites require assigned_location_id';
  end if;

  if invite_role = 'owner' then
    raise exception 'Cannot invite another owner';
  end if;

  insert into public.invitations (
    org_id,
    email,
    role,
    assigned_location_id,
    token,
    expires_at
  )
  values (
    v_org_id,
    lower(trim(invite_email)),
    invite_role,
    invite_location_id,
    encode(extensions.gen_random_bytes(32), 'hex'),
    now() + interval '7 days'
  )
  returning * into v_invite;

  return v_invite;
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
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Profile already exists';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then
    raise exception 'Authenticated user has no email';
  end if;

  select * into v_invite
  from public.invitations
  where token = invite_token
  for update;

  if v_invite.id is null then
    raise exception 'Invitation not found';
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
end;
$$;

create or replace function public.get_invitation_by_token(invite_token text)
returns table (
  id uuid,
  org_id uuid,
  org_name text,
  email text,
  role public.org_role,
  assigned_location_id uuid,
  expires_at timestamptz,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.org_id,
    o.name as org_name,
    i.email,
    i.role,
    i.assigned_location_id,
    i.expires_at,
    i.accepted_at
  from public.invitations i
  join public.orgs o on o.id = i.org_id
  where i.token = invite_token;
$$;

revoke all on function public.create_org_with_owner(text, text, text) from public;
revoke all on function public.sign_org_attestation(text, text) from public;
revoke all on function public.create_invitation(text, public.org_role, uuid) from public;
revoke all on function public.accept_invitation(text, text) from public;
revoke all on function public.get_invitation_by_token(text) from public;

grant execute on function public.create_org_with_owner(text, text, text) to authenticated;
grant execute on function public.sign_org_attestation(text, text) to authenticated;
grant execute on function public.create_invitation(text, public.org_role, uuid) to authenticated;
grant execute on function public.accept_invitation(text, text) to authenticated;
grant execute on function public.get_invitation_by_token(text) to authenticated;
grant execute on function public.get_invitation_by_token(text) to anon;
