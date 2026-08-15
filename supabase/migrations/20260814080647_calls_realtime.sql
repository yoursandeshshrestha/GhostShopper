-- Push call row changes to connected clients when ElevenLabs webhooks update the DB.

do $$
begin
  alter publication supabase_realtime add table public.calls;
exception
  when duplicate_object then null;
end $$;
