-- Allow platform superadmins to suspend organisation owners.

create or replace function public.suspend_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_org_id uuid;
  v_caller_role public.profile_role;
  v_member public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot suspend yourself';
  end if;

  select org_id, role into v_caller_org_id, v_caller_role
  from public.profiles
  where id = auth.uid();

  select * into v_member
  from public.profiles
  where id = p_user_id;

  if v_member.id is null then
    raise exception 'User not found';
  end if;

  if v_member.role = 'superadmin' then
    raise exception 'Cannot suspend a platform superadmin';
  end if;

  if v_member.role = 'owner' and v_caller_role <> 'superadmin' then
    raise exception 'Only platform superadmins can suspend organisation owners';
  end if;

  if v_caller_role = 'superadmin' then
    null;
  elsif v_caller_role in ('owner', 'admin')
    and v_member.org_id = v_caller_org_id then
    null;
  else
    raise exception 'Only owners and admins can suspend team members';
  end if;

  update public.profiles
  set
    suspended_at = now(),
    suspended_by = auth.uid(),
    updated_at = now()
  where id = p_user_id
    and suspended_at is null;
end;
$$;
