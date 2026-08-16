-- Join invited users to their org on first login (no invite-token click required).
-- Also block creating a second org when a pending invite already exists for that email.

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

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then
    raise exception 'Authenticated user has no email';
  end if;

  if exists (
    select 1
    from public.invitations
    where lower(email) = v_email
      and accepted_at is null
      and expires_at > now()
  ) then
    raise exception 'This email has a pending team invitation. Sign in to join that organisation.';
  end if;

  if exists (
    select 1
    from public.platform_invitations
    where lower(email) = v_email
      and accepted_at is null
      and expires_at > now()
  ) then
    raise exception 'This email has a pending platform invitation. Sign in to accept it.';
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

revoke all on function public.claim_pending_invitation(text) from public;
revoke all on function public.claim_pending_invitation(text) from anon;
grant execute on function public.claim_pending_invitation(text) to authenticated;
