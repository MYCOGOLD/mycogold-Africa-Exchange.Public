-- Institution APIs, member-authorised data sharing and credit-activity evidence.
-- Private server-side schema foundation only. No external partner is provisioned
-- and no member data is exposed by this migration. Apply in staging after review.

create table if not exists private.institution_api_clients (
  id uuid primary key default gen_random_uuid(),
  institution_name text not null,
  institution_type text not null check (institution_type in (
    'bank',
    'deposit_taking_sacco',
    'non_deposit_taking_sacco',
    'licensed_digital_credit_provider',
    'licensed_credit_reference_bureau',
    'other_authorised_lender'
  )),
  client_id text not null unique,
  client_secret_hash text not null,
  scopes text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'revoked')),
  contract_reference text,
  regulatory_reference text,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  expires_at timestamptz,
  max_requests_per_minute integer not null default 60 check (max_requests_per_minute between 1 and 600),
  allowed_ip_cidrs cidr[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_client_approval_shape check (
    status <> 'active' or (approved_by is not null and approved_at is not null and contract_reference is not null)
  )
);

create table if not exists private.member_data_sharing_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  institution_client_id uuid not null references private.institution_api_clients(id) on delete restrict,
  purpose text not null check (purpose in ('credit_assessment', 'member_activity_statement')),
  scopes text[] not null,
  disclosure_version text not null,
  disclosure_sha256 text not null check (disclosure_sha256 ~ '^[0-9a-f]{64}$'),
  capture_method text not null check (capture_method in ('in_app_confirmed', 'verified_paper_form')),
  consented_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint member_consent_expiry check (expires_at > consented_at),
  constraint member_consent_revocation check (revoked_at is null or revoked_at >= consented_at)
);

create index if not exists member_data_sharing_consents_active_idx
  on private.member_data_sharing_consents (user_id, institution_client_id, expires_at desc)
  where revoked_at is null;

create table if not exists private.member_consent_audit_events (
  id bigint generated always as identity primary key,
  consent_id uuid not null references private.member_data_sharing_consents(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  institution_client_id uuid not null references private.institution_api_clients(id) on delete restrict,
  event_type text not null check (event_type in ('granted', 'revoked', 'expired', 'corrected')),
  event_sha256 text not null check (event_sha256 ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz not null default now()
);

create index if not exists member_consent_audit_events_consent_idx
  on private.member_consent_audit_events (consent_id, occurred_at desc);

create table if not exists private.institution_api_access_logs (
  id bigint generated always as identity primary key,
  institution_client_id uuid not null references private.institution_api_clients(id) on delete restrict,
  consent_id uuid references private.member_data_sharing_consents(id) on delete restrict,
  request_id uuid not null,
  resource_scope text not null,
  resource_path text not null,
  http_status integer not null check (http_status between 100 and 599),
  response_sha256 text check (response_sha256 is null or response_sha256 ~ '^[0-9a-f]{64}$'),
  accessed_at timestamptz not null default now()
);

create index if not exists institution_api_access_logs_client_time_idx
  on private.institution_api_access_logs (institution_client_id, accessed_at desc);

create index if not exists institution_api_access_logs_consent_time_idx
  on private.institution_api_access_logs (consent_id, accessed_at desc)
  where consent_id is not null;

create table if not exists private.credit_activity_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  coverage_start date not null,
  coverage_end date not null,
  methodology_version text not null,
  completed_settled_trades integer not null default 0 check (completed_settled_trades >= 0),
  settled_turnover_kes numeric(18,2) not null default 0 check (settled_turnover_kes >= 0),
  active_trading_months integer not null default 0 check (active_trading_months between 0 and 120),
  completed_deliveries integer not null default 0 check (completed_deliveries >= 0),
  on_time_deliveries integer not null default 0 check (on_time_deliveries >= 0),
  disputes integer not null default 0 check (disputes >= 0),
  reversals integer not null default 0 check (reversals >= 0),
  coverage_notes text not null,
  source_bundle_sha256 text not null check (source_bundle_sha256 ~ '^[0-9a-f]{64}$'),
  generated_at timestamptz not null default now(),
  constraint credit_activity_coverage check (coverage_end >= coverage_start),
  constraint credit_activity_delivery_count check (on_time_deliveries <= completed_deliveries),
  unique (user_id, coverage_start, coverage_end, methodology_version)
);

comment on table private.institution_api_clients is
  'Approved institution API clients. Store only a strong one-way credential hash, never a plaintext client secret.';
comment on table private.member_data_sharing_consents is
  'Purpose-, institution- and scope-specific member consent. Revocation stops future access; retain the audit trail.';
comment on table private.member_consent_audit_events is
  'Append-only evidence of member data-sharing consent, revocation, expiry and correction.';
comment on table private.institution_api_access_logs is
  'Append-only institutional API access audit. Store digests and metadata, never raw personal response bodies.';
comment on table private.credit_activity_facts is
  'Factual, period-bound exchange activity only. This is not a credit score, lending recommendation, CRB report or loan decision.';

alter table private.institution_api_clients enable row level security;
alter table private.member_data_sharing_consents enable row level security;
alter table private.member_consent_audit_events enable row level security;
alter table private.institution_api_access_logs enable row level security;
alter table private.credit_activity_facts enable row level security;

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;
grant all on table
  private.institution_api_clients,
  private.member_data_sharing_consents,
  private.member_consent_audit_events,
  private.institution_api_access_logs,
  private.credit_activity_facts
to service_role;
grant usage, select on all sequences in schema private to service_role;

drop trigger if exists member_consent_audit_events_immutable on private.member_consent_audit_events;
create trigger member_consent_audit_events_immutable
before update or delete on private.member_consent_audit_events
for each row execute function private.reject_immutable_record_mutation();

drop trigger if exists institution_api_access_logs_immutable on private.institution_api_access_logs;
create trigger institution_api_access_logs_immutable
before update or delete on private.institution_api_access_logs
for each row execute function private.reject_immutable_record_mutation();
