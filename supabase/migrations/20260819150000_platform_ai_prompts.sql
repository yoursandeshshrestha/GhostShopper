-- Superadmin-editable system prompts for live calls, scenario generation, and grading.

alter table public.platform_ai_settings
  add column if not exists caller_system_prompt text not null default '',
  add column if not exists scenario_system_prompt text not null default '',
  add column if not exists grading_system_prompt text not null default '';

drop function if exists public.update_platform_ai_settings(text, text);

create or replace function public.update_platform_ai_settings(
  p_scenario_model text,
  p_grading_model text,
  p_caller_system_prompt text,
  p_scenario_system_prompt text,
  p_grading_system_prompt text
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
    raise exception 'Only platform superadmins can change AI settings';
  end if;

  if nullif(trim(p_scenario_model), '') is null then
    raise exception 'Scenario model is required';
  end if;

  if nullif(trim(p_grading_model), '') is null then
    raise exception 'Call analysis model is required';
  end if;

  if nullif(trim(p_caller_system_prompt), '') is null then
    raise exception 'Live caller prompt is required';
  end if;

  if nullif(trim(p_scenario_system_prompt), '') is null then
    raise exception 'Scenario prompt is required';
  end if;

  if nullif(trim(p_grading_system_prompt), '') is null then
    raise exception 'Call analysis prompt is required';
  end if;

  if length(p_caller_system_prompt) > 50000
    or length(p_scenario_system_prompt) > 50000
    or length(p_grading_system_prompt) > 50000 then
    raise exception 'Prompt is too long';
  end if;

  update public.platform_ai_settings
  set
    scenario_model = trim(p_scenario_model),
    grading_model = trim(p_grading_model),
    caller_system_prompt = trim(p_caller_system_prompt),
    scenario_system_prompt = trim(p_scenario_system_prompt),
    grading_system_prompt = trim(p_grading_system_prompt),
    updated_by = auth.uid(),
    updated_at = now()
  where id = 1
  returning * into v_settings;

  if v_settings.id is null then
    insert into public.platform_ai_settings (
      id,
      scenario_model,
      grading_model,
      caller_system_prompt,
      scenario_system_prompt,
      grading_system_prompt,
      updated_by
    )
    values (
      1,
      trim(p_scenario_model),
      trim(p_grading_model),
      trim(p_caller_system_prompt),
      trim(p_scenario_system_prompt),
      trim(p_grading_system_prompt),
      auth.uid()
    )
    returning * into v_settings;
  end if;

  return v_settings;
end;
$$;

revoke all on function public.update_platform_ai_settings(text, text, text, text, text) from public;
grant execute on function public.update_platform_ai_settings(text, text, text, text, text) to authenticated;
