-- GhostShopper core identity schema.

-- Org-scoped roles (invitations / membership within an org)
create type public.org_role as enum (
  'owner',
  'admin',
  'coach',
  'location_viewer'
);

-- All profile roles including platform superadmin
create type public.profile_role as enum (
  'owner',
  'admin',
  'coach',
  'location_viewer',
  'superadmin'
);

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  attestation_signed_at timestamptz,
  attestation_signed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- profiles.id matches auth.users.id
-- org_id is null only for platform superadmins
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid references public.orgs (id) on delete cascade,
  email text not null,
  full_name text,
  role public.profile_role not null,
  assigned_location_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_org_consistency check (
    (role = 'superadmin' and org_id is null)
    or (role <> 'superadmin' and org_id is not null)
  ),
  constraint profiles_location_viewer_assignment check (
    role <> 'location_viewer'
    or assigned_location_id is not null
  )
);

create index profiles_org_idx on public.profiles (org_id);
create index profiles_role_idx on public.profiles (role);
create index profiles_assigned_location_idx on public.profiles (assigned_location_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  email text not null,
  role public.org_role not null,
  assigned_location_id uuid,
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitations_location_viewer_assignment check (
    role <> 'location_viewer'
    or assigned_location_id is not null
  )
);

create index invitations_org_idx on public.invitations (org_id);
create index invitations_email_idx on public.invitations (email);
create index invitations_token_idx on public.invitations (token);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orgs_set_updated_at
before update on public.orgs
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
