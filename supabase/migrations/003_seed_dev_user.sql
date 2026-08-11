-- Seed:
--   Superadmin (no org): admin@ghostshopper.dev / sandesh@123
--   Owner:               user@example.com / sandesh@123

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_superadmin_id uuid := 'a0000000-0000-4000-8000-000000000099';
  v_owner_id uuid := 'a0000000-0000-4000-8000-000000000001';
  v_org_id uuid := 'b0000000-0000-4000-8000-000000000001';
  v_password text := 'sandesh@123';
begin
  -- Superadmin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_superadmin_id,
    'authenticated',
    'authenticated',
    'admin@ghostshopper.dev',
    extensions.crypt(v_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Platform Superadmin"}'::jsonb,
    now(), now(), '', '', '', ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  )
  values (
    v_superadmin_id,
    v_superadmin_id,
    jsonb_build_object(
      'sub', v_superadmin_id::text,
      'email', 'admin@ghostshopper.dev',
      'email_verified', true
    ),
    'email',
    v_superadmin_id::text,
    now(), now(), now()
  )
  on conflict do nothing;

  insert into public.profiles (id, org_id, email, full_name, role)
  values (
    v_superadmin_id,
    null,
    'admin@ghostshopper.dev',
    'Platform Superadmin',
    'superadmin'
  )
  on conflict (id) do nothing;

  -- Owner + org
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_owner_id,
    'authenticated',
    'authenticated',
    'user@example.com',
    extensions.crypt(v_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Sandesh Shrestha"}'::jsonb,
    now(), now(), '', '', '', ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  )
  values (
    v_owner_id,
    v_owner_id,
    jsonb_build_object(
      'sub', v_owner_id::text,
      'email', 'user@example.com',
      'email_verified', true
    ),
    'email',
    v_owner_id::text,
    now(), now(), now()
  )
  on conflict do nothing;

  insert into public.orgs (id, name, industry, attestation_signed_by, attestation_signed_at)
  values (
    v_org_id,
    'GhostShopper Dev',
    'Home care',
    'Sandesh Shrestha (Owner)',
    now()
  )
  on conflict (id) do nothing;

  insert into public.profiles (id, org_id, email, full_name, role)
  values (
    v_owner_id,
    v_org_id,
    'user@example.com',
    'Sandesh Shrestha',
    'owner'
  )
  on conflict (id) do nothing;
end $$;
