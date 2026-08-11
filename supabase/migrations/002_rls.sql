-- RLS helpers and policies.

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
    where id = auth.uid() and role = 'superadmin'
  )
$$;

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_profile_role()
returns public.profile_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

alter table public.orgs enable row level security;
alter table public.profiles enable row level security;
alter table public.invitations enable row level security;

-- Orgs
create policy orgs_select on public.orgs
  for select to authenticated
  using (public.is_superadmin() or id = public.current_org_id());

create policy orgs_update on public.orgs
  for update to authenticated
  using (
    public.is_superadmin()
    or (
      id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  )
  with check (
    public.is_superadmin()
    or (
      id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  );

-- Profiles
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    public.is_superadmin()
    or id = auth.uid()
    or org_id = public.current_org_id()
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (
    public.is_superadmin()
    or id = auth.uid()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  )
  with check (
    public.is_superadmin()
    or id = auth.uid()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  );

-- Invitations: owner/admin manage; invitee can read their own pending invite by email via RPC
create policy invitations_select on public.invitations
  for select to authenticated
  using (
    public.is_superadmin()
    or org_id = public.current_org_id()
  );

create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  );

create policy invitations_update on public.invitations
  for update to authenticated
  using (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  )
  with check (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  );

create policy invitations_delete on public.invitations
  for delete to authenticated
  using (
    public.is_superadmin()
    or (
      org_id = public.current_org_id()
      and public.current_profile_role() in ('owner', 'admin')
    )
  );
