-- Platform superadmin invites (no organisation).

create table if not exists public.platform_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists platform_invitations_pending_email
  on public.platform_invitations (lower(email))
  where accepted_at is null;

alter table public.platform_invitations enable row level security;

create policy platform_invitations_select on public.platform_invitations
  for select to authenticated
  using (public.is_superadmin());

create policy platform_invitations_insert on public.platform_invitations
  for insert to authenticated
  with check (public.is_superadmin());

create policy platform_invitations_update on public.platform_invitations
  for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy platform_invitations_delete on public.platform_invitations
  for delete to authenticated
  using (public.is_superadmin());

create or replace function public.create_platform_invitation(invite_email text)
returns public.platform_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_invite public.platform_invitations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_superadmin() then
    raise exception 'Only platform superadmins can invite other superadmins';
  end if;

  v_email := lower(trim(invite_email));
  if v_email = '' or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'A valid email is required';
  end if;

  if exists (
    select 1 from public.profiles
    where lower(email) = v_email and role = 'superadmin'
  ) then
    raise exception 'That person is already a platform superadmin';
  end if;

  if exists (
    select 1 from public.profiles
    where lower(email) = v_email and role <> 'superadmin'
  ) then
    raise exception 'That email already belongs to an organisation account';
  end if;

  insert into public.platform_invitations (
    email,
    token,
    expires_at,
    created_by
  )
  values (
    v_email,
    encode(extensions.gen_random_bytes(32), 'hex'),
    now() + interval '7 days',
    auth.uid()
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

drop function if exists public.get_invitation_by_token(text);

create function public.get_invitation_by_token(invite_token text)
returns table (
  id uuid,
  org_id uuid,
  org_name text,
  email text,
  role text,
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
    i.role::text,
    i.assigned_location_id,
    i.expires_at,
    i.accepted_at
  from public.invitations i
  join public.orgs o on o.id = i.org_id
  where i.token = invite_token

  union all

  select
    p.id,
    null::uuid,
    'GhostShopper'::text,
    p.email,
    'superadmin'::text,
    null::uuid,
    p.expires_at,
    p.accepted_at
  from public.platform_invitations p
  where p.token = invite_token;
$$;

revoke all on function public.create_platform_invitation(text) from public;
revoke all on function public.create_platform_invitation(text) from anon;
grant execute on function public.create_platform_invitation(text) to authenticated;

revoke all on function public.accept_invitation(text, text) from public;
grant execute on function public.accept_invitation(text, text) to authenticated;

revoke all on function public.get_invitation_by_token(text) from public;
grant execute on function public.get_invitation_by_token(text) to authenticated;
grant execute on function public.get_invitation_by_token(text) to anon;
