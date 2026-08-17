-- Seed Levi as a platform superadmin. Login is magic link only.
-- Reuses an existing auth user with this email if one already exists.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_email text := 'levi@milktreeagency.com';
  v_full_name text := 'Levi';
  v_superadmin_id uuid;
begin
  select id into v_superadmin_id
  from auth.users
  where lower(email) = v_email
  limit 1;

  if v_superadmin_id is null then
    v_superadmin_id := 'a0000000-0000-4000-8000-000000000098';

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
      jsonb_build_object('full_name', v_full_name),
      now(), now(), '', '', '', ''
    );

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
  else
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
          || jsonb_build_object('full_name', v_full_name),
        updated_at = now()
    where id = v_superadmin_id;
  end if;

  insert into public.profiles (id, org_id, email, full_name, role)
  values (
    v_superadmin_id,
    null,
    v_email,
    v_full_name,
    'superadmin'
  )
  on conflict (id) do update
    set org_id = null,
        email = excluded.email,
        full_name = excluded.full_name,
        role = 'superadmin';
end $$;
