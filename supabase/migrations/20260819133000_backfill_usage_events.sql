-- Backfill usage_events from historical calls (superadmin only, idempotent).

create or replace function public.estimate_call_duration_secs(c public.calls)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(
    c.duration_secs,
    (
      select max((seg->>'t')::integer)
      from jsonb_array_elements(
        case
          when c.transcript_json is not null
            and jsonb_typeof(c.transcript_json->'segments') = 'array'
          then c.transcript_json->'segments'
          else '[]'::jsonb
        end
      ) as seg
      where seg ? 't'
    ),
    case
      when c.started_at is not null and c.completed_at is not null then
        greatest(
          0,
          floor(extract(epoch from (c.completed_at - c.started_at)))::integer
        )
      else 0
    end,
    0
  );
$$;

create or replace function public.backfill_usage_events()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voice_rate numeric;
  v_voice_inserted bigint := 0;
  v_grade_inserted bigint := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_superadmin() then
    raise exception 'Only platform superadmins can backfill usage';
  end if;

  select coalesce(voice_usd_per_minute, 0.10)
  into v_voice_rate
  from public.platform_pricing
  where id = 1;

  if v_voice_rate is null then
    v_voice_rate := 0.10;
  end if;

  insert into public.usage_events (
    org_id,
    service,
    operation,
    resource_id,
    units,
    cost_usd,
    metadata,
    created_at
  )
  select
    c.org_id,
    'elevenlabs',
    'voice_call',
    c.id,
    jsonb_build_object(
      'duration_secs',
      public.estimate_call_duration_secs(c),
      'model',
      'backfill'
    ),
    round(
      (public.estimate_call_duration_secs(c)::numeric / 60.0) * v_voice_rate,
      6
    ),
    jsonb_build_object(
      'backfilled', true,
      'call_status', c.status::text,
      'estimated', c.duration_secs is null
    ),
    coalesce(c.completed_at, c.started_at, c.created_at)
  from public.calls c
  where (
      c.started_at is not null
      or c.external_conversation_id is not null
      or c.status in (
        'in_progress',
        'analysing',
        'awaiting_review',
        'completed',
        'failed',
        'missed',
        'voicemail',
        'line_busy',
        'short_call'
      )
    )
    and not exists (
      select 1
      from public.usage_events ue
      where ue.resource_id = c.id
        and ue.operation = 'voice_call'
    );

  get diagnostics v_voice_inserted = row_count;

  insert into public.usage_events (
    org_id,
    service,
    operation,
    resource_id,
    units,
    cost_usd,
    metadata,
    created_at
  )
  select
    c.org_id,
    'openrouter',
    'call_grade',
    c.id,
    jsonb_build_object(
      'prompt_tokens', 0,
      'completion_tokens', 0,
      'total_tokens', 0,
      'model', coalesce(c.grader_model, 'unknown')
    ),
    0,
    jsonb_build_object(
      'backfilled', true,
      'note', 'Historical grade — token cost not available'
    ),
    coalesce(c.ai_graded_at, c.completed_at, c.created_at)
  from public.calls c
  where c.ai_graded_at is not null
    and not exists (
      select 1
      from public.usage_events ue
      where ue.resource_id = c.id
        and ue.operation = 'call_grade'
    );

  get diagnostics v_grade_inserted = row_count;

  return jsonb_build_object(
    'voice_inserted', v_voice_inserted,
    'grade_inserted', v_grade_inserted
  );
end;
$$;

grant execute on function public.backfill_usage_events() to authenticated;
grant execute on function public.estimate_call_duration_secs(public.calls) to authenticated;
