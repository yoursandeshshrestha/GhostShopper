-- Platform voice pool for mystery-shop callers, plus caller identity on scenarios.

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'voice_gender'
  ) then
    create type public.voice_gender as enum ('female', 'male', 'neutral');
  end if;
end
$$;

create table if not exists public.platform_voices (
  id uuid primary key default gen_random_uuid(),
  elevenlabs_voice_id text not null unique,
  name text not null,
  gender public.voice_gender not null default 'neutral',
  preview_url text,
  labels jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_voices_enabled_gender_idx
  on public.platform_voices (enabled, gender);

alter table public.platform_voices enable row level security;

create policy platform_voices_select on public.platform_voices
  for select to authenticated
  using (public.is_superadmin());

create policy platform_voices_insert on public.platform_voices
  for insert to authenticated
  with check (public.is_superadmin());

create policy platform_voices_update on public.platform_voices
  for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy platform_voices_delete on public.platform_voices
  for delete to authenticated
  using (public.is_superadmin());

alter table public.scenarios
  add column if not exists caller_name text,
  add column if not exists caller_gender public.voice_gender;

alter table public.calls
  add column if not exists voice_id text,
  add column if not exists caller_name text,
  add column if not exists caller_gender public.voice_gender;
