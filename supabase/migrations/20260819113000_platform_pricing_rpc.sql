-- Superadmin RPC to update voice call pricing for spend metering.

create or replace function public.update_platform_pricing(
  p_voice_usd_per_minute numeric
)
returns public.platform_pricing
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pricing public.platform_pricing;
  v_rate numeric;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_superadmin() then
    raise exception 'Only platform superadmins can change pricing';
  end if;

  v_rate := p_voice_usd_per_minute;

  if v_rate is null or v_rate < 0 then
    raise exception 'Voice rate must be zero or greater';
  end if;

  update public.platform_pricing
  set voice_usd_per_minute = v_rate
  where id = 1
  returning * into v_pricing;

  if v_pricing.id is null then
    insert into public.platform_pricing (id, voice_usd_per_minute)
    values (1, v_rate)
    returning * into v_pricing;
  end if;

  return v_pricing;
end;
$$;

grant execute on function public.update_platform_pricing(numeric) to authenticated;
