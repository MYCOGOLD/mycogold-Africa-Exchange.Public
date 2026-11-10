-- MycoGold reward ledger, provider settlement records and verified MFPI foundations.
-- This migration defines private, server-only storage. It does NOT mint rewards,
-- collect funds, create a customer crypto wallet, publish MFPI, or enable escrow.
-- Do not apply to production until independently reviewed and exercised in staging.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.reward_protocol (
  singleton boolean primary key default true check (singleton),
  protocol_version text not null default '1.0.0',
  max_supply bigint not null default 67000000 check (max_supply = 67000000),
  total_issued bigint not null default 0 check (total_issued >= 0 and total_issued <= max_supply),
  reward_era_years integer not null default 4 check (reward_era_years = 4),
  genesis_at timestamptz,
  base_reward_points bigint check (base_reward_points is null or base_reward_points > 0),
  issuance_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint reward_issuance_requires_schedule
    check (not issuance_enabled or (genesis_at is not null and base_reward_points is not null))
);

insert into private.reward_protocol (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists private.reward_accounts (
  id uuid primary key default gen_random_uuid(),
  account_kind text not null check (account_kind in ('user', 'treasury')),
  user_id uuid references auth.users(id) on delete restrict,
  wallet_ref uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  constraint reward_account_owner_shape check (
    (account_kind = 'user' and user_id is not null)
    or (account_kind = 'treasury' and user_id is null)
  )
);

create unique index if not exists reward_accounts_one_user_wallet
  on private.reward_accounts(user_id) where account_kind = 'user';

create unique index if not exists reward_accounts_one_treasury
  on private.reward_accounts(account_kind) where account_kind = 'treasury';

create table if not exists private.verified_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  activity_type text not null,
  source_table text not null,
  source_id text not null,
  verifier_id uuid not null references auth.users(id) on delete restrict,
  verified_at timestamptz not null,
  verification_rule_version text not null,
  evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (activity_type, source_table, source_id, user_id)
);

create table if not exists private.reward_ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_kind text not null check (transaction_kind in ('issuance', 'reversal')),
  activity_event_id uuid references private.verified_activity_events(id) on delete restrict,
  reverses_transaction_id uuid references private.reward_ledger_transactions(id) on delete restrict,
  idempotency_key text not null unique,
  reason text not null,
  previous_hash text not null check (previous_hash ~ '^[0-9a-f]{64}$'),
  entry_hash text not null check (entry_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  constraint reward_transaction_reference_shape check (
    (transaction_kind = 'issuance' and activity_event_id is not null and reverses_transaction_id is null)
    or
    (transaction_kind = 'reversal' and activity_event_id is null and reverses_transaction_id is not null)
  )
);

create table if not exists private.reward_ledger_entries (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references private.reward_ledger_transactions(id) on delete restrict,
  account_id uuid not null references private.reward_accounts(id) on delete restrict,
  entry_side text not null check (entry_side in ('debit', 'credit')),
  points bigint not null check (points > 0),
  created_at timestamptz not null default now(),
  unique (transaction_id, account_id, entry_side)
);

create table if not exists private.reward_ledger_head (
  singleton boolean primary key default true check (singleton),
  latest_hash text not null default repeat('0', 64) check (latest_hash ~ '^[0-9a-f]{64}$'),
  sequence_number bigint not null default 0 check (sequence_number >= 0),
  updated_at timestamptz not null default now()
);

insert into private.reward_ledger_head(singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists private.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_reference text not null,
  event_type text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  signature_verified_at timestamptz,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_reference)
);

create table if not exists private.payment_settlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  provider_payment_reference text not null,
  amount_kes numeric(14,2) not null check (amount_kes > 0),
  payment_status text not null check (payment_status in (
    'pending', 'payment_confirmed', 'payment_failed', 'refund_pending',
    'refunded', 'disputed'
  )),
  payout_status text not null default 'not_started' check (payout_status in (
    'not_started', 'payout_pending', 'payout_confirmed', 'payout_failed', 'held'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_reference)
);

create table if not exists private.mfpi_observations (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references private.payment_settlements(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  commodity text not null,
  hub text not null,
  grade text not null,
  standard_unit text not null,
  quantity_standard numeric(18,4) not null check (quantity_standard > 0),
  unit_price_kes numeric(18,4) not null check (unit_price_kes > 0),
  settled_at timestamptz not null,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  methodology_version text not null,
  created_at timestamptz not null default now(),
  unique (settlement_id, methodology_version)
);

create table if not exists private.mfpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  commodity text not null,
  hub text not null,
  grade text not null,
  standard_unit text not null,
  index_value_kes numeric(18,4) not null check (index_value_kes > 0),
  sample_count integer not null check (sample_count > 0),
  aggregate_quantity numeric(18,4) not null check (aggregate_quantity > 0),
  dispersion numeric(18,6),
  methodology_version text not null,
  as_of timestamptz not null,
  published_at timestamptz,
  source_bundle_sha256 text not null check (source_bundle_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

comment on schema private is
  'Non-exposed, server-only MycoGold financial and verification records. Never grant browser roles access.';

comment on table private.reward_protocol is
  'Closed-loop, non-transferable reward points protocol. Hard cap 67m; four-year halving era; issuance disabled until schedule, genesis and approval are set.';
comment on table private.reward_accounts is
  'Internal ledger account identifiers only. wallet_ref is an opaque platform reference, not a blockchain address or keypair.';
comment on table private.reward_ledger_transactions is
  'Append-only, hash-chained reward accounting transactions. Credits and debits must balance; never edit or delete history.';
comment on table private.payment_settlements is
  'Metadata for external payment-provider settlement only. MycoGold must not store customer funds or treat this row as a custodial cash wallet.';
comment on table private.mfpi_observations is
  'Only verified, provider-confirmed and settled transactions qualify as MFPI observations. Asking prices and accepted order requests are not observations.';
comment on table private.mfpi_snapshots is
  'Versioned, auditable MFPI outputs. Keep unpublished until coverage, freshness and minimum sample rules pass.';

alter table private.reward_protocol enable row level security;
alter table private.reward_accounts enable row level security;
alter table private.verified_activity_events enable row level security;
alter table private.reward_ledger_transactions enable row level security;
alter table private.reward_ledger_entries enable row level security;
alter table private.reward_ledger_head enable row level security;
alter table private.payment_provider_events enable row level security;
alter table private.payment_settlements enable row level security;
alter table private.mfpi_observations enable row level security;
alter table private.mfpi_snapshots enable row level security;

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;
grant all on all tables in schema private to service_role;
grant usage, select on all sequences in schema private to service_role;

create or replace function private.reject_immutable_record_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'Immutable MycoGold audit records cannot be updated or deleted.'
    using errcode = '55000';
end;
$function$;

revoke all on function private.reject_immutable_record_mutation() from public, anon, authenticated, service_role;

drop trigger if exists verified_activity_events_immutable on private.verified_activity_events;
create trigger verified_activity_events_immutable
before update or delete on private.verified_activity_events
for each row execute function private.reject_immutable_record_mutation();

drop trigger if exists reward_ledger_transactions_immutable on private.reward_ledger_transactions;
create trigger reward_ledger_transactions_immutable
before update or delete on private.reward_ledger_transactions
for each row execute function private.reject_immutable_record_mutation();

drop trigger if exists reward_ledger_entries_immutable on private.reward_ledger_entries;
create trigger reward_ledger_entries_immutable
before update or delete on private.reward_ledger_entries
for each row execute function private.reject_immutable_record_mutation();

drop trigger if exists payment_provider_events_immutable on private.payment_provider_events;
create trigger payment_provider_events_immutable
before update or delete on private.payment_provider_events
for each row execute function private.reject_immutable_record_mutation();

drop trigger if exists mfpi_observations_immutable on private.mfpi_observations;
create trigger mfpi_observations_immutable
before update or delete on private.mfpi_observations
for each row execute function private.reject_immutable_record_mutation();

drop trigger if exists mfpi_snapshots_immutable on private.mfpi_snapshots;
create trigger mfpi_snapshots_immutable
before update or delete on private.mfpi_snapshots
for each row execute function private.reject_immutable_record_mutation();
