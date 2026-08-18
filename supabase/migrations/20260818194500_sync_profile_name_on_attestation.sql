-- Persist owner display name on profile when signing attestation.

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
  v_signed_by text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_signed_by := nullif(trim(signed_by), '');
  if v_signed_by is null then
    raise exception 'Signature name is required';
  end if;

  select org_id into v_org_id
  from public.profiles
  where id = auth.uid() and role = 'owner';

  if v_org_id is null then
    raise exception 'Only organisation owners can sign attestation';
  end if;

  update public.orgs
  set
    attestation_signed_by = v_signed_by
      || case
        when nullif(trim(job_title), '') is null then ''
        else ' (' || trim(job_title) || ')'
      end,
    attestation_signed_at = now(),
    updated_at = now()
  where id = v_org_id;

  update public.profiles
  set
    full_name = coalesce(nullif(trim(full_name), ''), v_signed_by),
    updated_at = now()
  where id = auth.uid()
    and nullif(trim(full_name), '') is null;
end;
$$;
