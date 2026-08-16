-- Minute job that invokes dispatch-scheduled-calls.
-- Vault secrets (project_url, schedule_cron_secret) are filled by
-- scripts/setup-schedule-cron.sh so this migration stays secret-free.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;
grant usage on schema private to postgres, supabase_admin, service_role;

create or replace function private.invoke_dispatch_scheduled_calls()
returns bigint
language plpgsql
security definer
set search_path = public, vault, net, extensions
as $$
declare
  request_id bigint;
  project_url text;
  cron_secret text;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  select decrypted_secret into cron_secret
  from vault.decrypted_secrets
  where name = 'schedule_cron_secret'
  limit 1;

  if project_url is null or cron_secret is null then
    raise warning 'schedule cron vault secrets are missing (project_url / schedule_cron_secret)';
    return null;
  end if;

  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/dispatch-scheduled-calls',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function private.invoke_dispatch_scheduled_calls() from public;
revoke all on function private.invoke_dispatch_scheduled_calls() from anon, authenticated;
grant execute on function private.invoke_dispatch_scheduled_calls()
  to postgres, supabase_admin, service_role;

select cron.schedule(
  'dispatch-scheduled-calls',
  '* * * * *',
  $$select private.invoke_dispatch_scheduled_calls()$$
);
