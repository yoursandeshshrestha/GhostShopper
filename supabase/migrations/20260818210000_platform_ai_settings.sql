-- Platform-wide AI model settings for scenario generation and call grading.

create table if not exists public.platform_ai_settings (
  id smallint primary key default 1 check (id = 1),
  scenario_model text not null default 'google/gemini-2.5-flash',
  grading_model text not null default 'google/gemini-2.5-flash',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.platform_ai_settings (id, scenario_model, grading_model)
values (1, 'google/gemini-2.5-flash', 'google/gemini-2.5-flash')
on conflict (id) do nothing;

create trigger platform_ai_settings_set_updated_at
before update on public.platform_ai_settings
for each row execute function public.set_updated_at();

alter table public.platform_ai_settings enable row level security;

create policy platform_ai_settings_select on public.platform_ai_settings
  for select to authenticated
  using (public.is_superadmin());

create policy platform_ai_settings_update on public.platform_ai_settings
  for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create or replace function public.update_platform_ai_settings(
  p_scenario_model text,
  p_grading_model text
)
returns public.platform_ai_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.platform_ai_settings;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_superadmin() then
    raise exception 'Only platform superadmins can change AI model settings';
  end if;

  if nullif(trim(p_scenario_model), '') is null then
    raise exception 'Scenario model is required';
  end if;

  if nullif(trim(p_grading_model), '') is null then
    raise exception 'Call analysis model is required';
  end if;

  update public.platform_ai_settings
  set
    scenario_model = trim(p_scenario_model),
    grading_model = trim(p_grading_model),
    updated_by = auth.uid(),
    updated_at = now()
  where id = 1
  returning * into v_settings;

  if v_settings.id is null then
    insert into public.platform_ai_settings (
      id,
      scenario_model,
      grading_model,
      updated_by
    )
    values (
      1,
      trim(p_scenario_model),
      trim(p_grading_model),
      auth.uid()
    )
    returning * into v_settings;
  end if;

  return v_settings;
end;
$$;

revoke all on function public.update_platform_ai_settings(text, text) from public;
grant execute on function public.update_platform_ai_settings(text, text) to authenticated;
