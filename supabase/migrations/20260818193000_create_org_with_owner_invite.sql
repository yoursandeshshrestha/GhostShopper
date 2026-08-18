-- Create org + owner invite in one step for superadmin provisioning.

drop function if exists public.create_org_as_superadmin(text, text);

create or replace function public.create_org_as_superadmin(
  org_name text,
  org_industry text default null,
  owner_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_email text;
  v_invite public.invitations;
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

  v_email := lower(trim(owner_email));
  if v_email = '' or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'A valid owner email is required';
  end if;

  insert into public.orgs (name, industry)
  values (trim(org_name), nullif(trim(org_industry), ''))
  returning id into v_org_id;

  insert into public.invitations (
    org_id,
    email,
    role,
    token,
    expires_at
  )
  values (
    v_org_id,
    v_email,
    'owner',
    encode(extensions.gen_random_bytes(32), 'hex'),
    now() + interval '7 days'
  )
  returning * into v_invite;

  return jsonb_build_object(
    'org_id', v_org_id,
    'org_name', trim(org_name),
    'invite', jsonb_build_object(
      'id', v_invite.id,
      'email', v_invite.email,
      'role', v_invite.role,
      'token', v_invite.token,
      'expires_at', v_invite.expires_at
    )
  );
end;
$$;

revoke all on function public.create_org_as_superadmin(text, text, text) from public;
grant execute on function public.create_org_as_superadmin(text, text, text) to authenticated;
