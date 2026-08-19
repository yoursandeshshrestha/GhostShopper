-- One-time idempotent backfill of usage_events from existing calls.

do $$
declare
  v_voice_rate numeric;
begin
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
end;
$$;
