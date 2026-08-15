-- Private bucket for ElevenLabs call recordings (MP3).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'call-recordings',
  'call-recordings',
  false,
  52428800,
  array['audio/mpeg', 'audio/mp3']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists call_recordings_select on storage.objects;

create policy call_recordings_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'call-recordings'
    and (
      public.is_superadmin()
      or (storage.foldername(name))[1] = public.current_org_id()::text
    )
  );
