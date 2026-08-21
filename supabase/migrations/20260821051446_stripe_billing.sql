-- Stripe billing: subscription tiers, invoices, audit log, and enforcement.

do $$ begin
  create type public.subscription_tier as enum (
    'local',
    'growth',
    'scale',
    'brand'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.subscription_cadence as enum (
    'weekly',
    'intensive'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.billing_period as enum (
    'monthly',
    'annual'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.org_subscription_status as enum (
    'audit',
    'active',
    'past_due',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.billing_subscription_status as enum (
    'pending',
    'active',
    'past_due',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.billing_invoice_status as enum (
    'draft',
    'open',
    'paid',
    'void',
    'uncollectible'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.orgs
  add column if not exists subscription_status public.org_subscription_status
    not null default 'audit',
  add column if not exists stripe_customer_id text,
  add column if not exists past_due_since timestamptz;

create unique index if not exists orgs_stripe_customer_id_idx
  on public.orgs (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists orgs_subscription_status_idx
  on public.orgs (subscription_status);

alter table public.locations
  add column if not exists opted_out_at timestamptz,
  add column if not exists paused_at timestamptz;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.orgs (id) on delete cascade,
  tier public.subscription_tier not null,
  cadence public.subscription_cadence not null default 'weekly',
  billing_period public.billing_period not null default 'monthly',
  status public.billing_subscription_status not null default 'pending',
  location_quantity integer not null default 0,
  stripe_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  setup_fee_status text not null default 'pending',
  first_invoice_raised_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_setup_fee_status_check check (
    setup_fee_status in ('pending', 'charged', 'waived')
  ),
  constraint subscriptions_location_quantity_check check (
    location_quantity >= 0
  )
);

create index if not exists subscriptions_status_idx
  on public.subscriptions (status);

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create table if not exists public.stripe_prices (
  price_key text primary key,
  stripe_product_id text not null,
  stripe_price_id text not null,
  nickname text not null,
  currency text not null default 'gbp',
  unit_amount_pence integer not null,
  interval text,
  usage_type text not null default 'licensed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger stripe_prices_set_updated_at
before update on public.stripe_prices
for each row execute function public.set_updated_at();

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  stripe_invoice_id text unique,
  status public.billing_invoice_status not null default 'draft',
  hosted_invoice_url text,
  currency text not null default 'gbp',
  amount_due_pence integer not null default 0,
  amount_paid_pence integer not null default 0,
  includes_setup_fee boolean not null default false,
  intensive boolean not null default false,
  adjustment_percent numeric,
  adjustment_pence integer not null default 0,
  raised_by uuid references auth.users (id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_adjustment_percent_check check (
    adjustment_percent is null
    or (adjustment_percent >= 0 and adjustment_percent <= 10)
  )
);

create index if not exists invoices_org_idx on public.invoices (org_id, created_at desc);

create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs (id) on delete set null,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_org_idx
  on public.audit_log (org_id, created_at desc);

create index if not exists audit_log_action_idx
  on public.audit_log (action, created_at desc);

-- ---------------------------------------------------------------------------
-- Brand quantity: active (not opted out, not paused) location count
-- ---------------------------------------------------------------------------
create or replace function public.active_location_count(p_org_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::integer
  from public.locations
  where org_id = p_org_id
    and opted_out_at is null
    and paused_at is null
$$;

create or replace function public.sync_org_location_quantity(p_org_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  update public.subscriptions s
  set location_quantity = public.active_location_count(s.org_id)
  where (p_org_id is null or s.org_id = p_org_id)
    and s.status in ('pending', 'active', 'past_due');

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

create or replace function public.locations_sync_quantity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  v_org_id := coalesce(new.org_id, old.org_id);
  perform public.sync_org_location_quantity(v_org_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists locations_sync_quantity on public.locations;
create trigger locations_sync_quantity
after insert or update of org_id, opted_out_at, paused_at or delete
on public.locations
for each row execute function public.locations_sync_quantity();

-- ---------------------------------------------------------------------------
-- Soft location-band block. Superadmin override is an explicit RPC.
-- ---------------------------------------------------------------------------
create or replace function public.tier_max_locations(p_tier public.subscription_tier)
returns integer
language sql
immutable
as $$
  select case p_tier
    when 'local' then 6
    when 'growth' then 15
    when 'scale' then 40
    else null
  end
$$;

create or replace function public.locations_enforce_band()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier public.subscription_tier;
  v_max integer;
  v_count integer;
  v_override text;
begin
  v_override := current_setting('ghostshopper.location_band_override', true);

  select s.tier into v_tier
  from public.subscriptions s
  where s.org_id = new.org_id
    and s.status in ('pending', 'active', 'past_due');

  if v_tier is null then
    return new;
  end if;

  v_max := public.tier_max_locations(v_tier);
  if v_max is null then
    return new;
  end if;

  select count(*) into v_count
  from public.locations
  where org_id = new.org_id;

  if tg_op = 'UPDATE' then
    v_count := v_count - 1;
  end if;

  if v_count + 1 > v_max then
    if v_override = 'true' and public.is_superadmin() then
      return new;
    end if;

    raise exception
      'LOCATION_BAND_EXCEEDED: This organisation is on the % plan, which covers up to % locations. Upgrade is required before adding another.',
      initcap(v_tier::text),
      v_max;
  end if;

  return new;
end;
$$;

drop trigger if exists locations_enforce_band on public.locations;
create trigger locations_enforce_band
before insert or update of org_id
on public.locations
for each row execute function public.locations_enforce_band();

create or replace function public.create_location_with_band_override(
  p_org_id uuid,
  p_name text,
  p_phone text default null,
  p_timezone text default null,
  p_country text default null,
  p_call_frequency text default null
)
returns public.locations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location public.locations;
  v_tier public.subscription_tier;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_superadmin() then
    raise exception 'Only platform superadmins can override the location band';
  end if;

  perform set_config('ghostshopper.location_band_override', 'true', true);

  insert into public.locations (
    org_id, name, phone, timezone, country, call_frequency
  )
  values (
    p_org_id,
    trim(p_name),
    nullif(trim(p_phone), ''),
    nullif(trim(p_timezone), ''),
    nullif(trim(p_country), ''),
    nullif(trim(p_call_frequency), '')
  )
  returning * into v_location;

  select s.tier into v_tier
  from public.subscriptions s
  where s.org_id = p_org_id
  limit 1;

  select count(*) into v_count
  from public.locations
  where org_id = p_org_id;

  insert into public.audit_log (org_id, actor_id, action, metadata)
  values (
    p_org_id,
    auth.uid(),
    'location_band_override',
    jsonb_build_object(
      'location_id', v_location.id,
      'tier', v_tier,
      'location_count', v_count
    )
  );

  return v_location;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.audit_log enable row level security;
alter table public.stripe_prices enable row level security;

create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (public.is_superadmin() or org_id = public.current_org_id());

create policy invoices_select on public.invoices
  for select to authenticated
  using (public.is_superadmin() or org_id = public.current_org_id());

create policy audit_log_select on public.audit_log
  for select to authenticated
  using (public.is_superadmin());

create policy stripe_prices_select on public.stripe_prices
  for select to authenticated
  using (public.is_superadmin());

revoke all on function public.sync_org_location_quantity(uuid) from public;
revoke all on function public.create_location_with_band_override(uuid, text, text, text, text, text) from public;
grant execute on function public.sync_org_location_quantity(uuid) to service_role;
grant execute on function public.create_location_with_band_override(uuid, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Nightly Brand quantity resync (2:00 UTC)
-- ---------------------------------------------------------------------------
do $$
begin
  perform cron.unschedule('sync-brand-location-quantity');
exception
  when others then
    null;
end $$;

select cron.schedule(
  'sync-brand-location-quantity',
  '0 2 * * *',
  $$select public.sync_org_location_quantity(null)$$
);
