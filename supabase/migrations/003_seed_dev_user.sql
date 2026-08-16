-- Seed the platform superadmin. Login is magic link only.
--   Superadmin (no org): yousandeshshrestha@gmail.com

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_superadmin_id uuid := 'a0000000-0000-4000-8000-000000000099';
  v_email text := 'yoursandeshshrestha@gmail.com';
begin
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
    v_email,
    extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Sandesh Shrestha"}'::jsonb,
    now(), now(), '', '', '', ''
  )
  on conflict (id) do update
    set email = excluded.email,
        email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
        raw_user_meta_data = excluded.raw_user_meta_data,
        updated_at = now();

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  )
  values (
    v_superadmin_id,
    v_superadmin_id,
    jsonb_build_object(
      'sub', v_superadmin_id::text,
      'email', v_email,
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
    v_email,
    'Sandesh Shrestha',
    'superadmin'
  )
  on conflict (id) do update
    set org_id = null,
        email = excluded.email,
        full_name = excluded.full_name,
        role = 'superadmin';
end $$;
