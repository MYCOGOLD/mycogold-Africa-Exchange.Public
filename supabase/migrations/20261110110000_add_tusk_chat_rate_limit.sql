-- TUSK AI chat rate limiting.
-- Safe to apply after review; this migration does not enable TUSK or call OpenAI.
-- The function is callable only by service_role and serializes requests per user.

create table if not exists public.tusk_api_rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists tusk_api_rate_limit_events_user_created_idx
  on public.tusk_api_rate_limit_events (user_id, created_at desc);

alter table public.tusk_api_rate_limit_events enable row level security;

revoke all on table public.tusk_api_rate_limit_events from anon, authenticated;
grant select, insert, delete on table public.tusk_api_rate_limit_events to service_role;
grant usage, select on sequence public.tusk_api_rate_limit_events_id_seq to service_role;

create or replace function public.consume_tusk_chat_rate_limit(
  p_user_id uuid,
  p_window_seconds integer default 60,
  p_max_requests integer default 8
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_cutoff timestamptz;
  v_recent_count bigint;
begin
  if p_user_id is null
    or p_window_seconds < 1
    or p_window_seconds > 3600
    or p_max_requests < 1
    or p_max_requests > 60 then
    raise exception 'Invalid TUSK rate-limit parameters.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  v_cutoff := v_now - pg_catalog.make_interval(secs => p_window_seconds);

  delete from public.tusk_api_rate_limit_events
  where user_id = p_user_id
    and created_at < v_now - interval '1 day';

  select count(*)
    into v_recent_count
  from public.tusk_api_rate_limit_events
  where user_id = p_user_id
    and created_at >= v_cutoff;

  if v_recent_count >= p_max_requests then
    return false;
  end if;

  insert into public.tusk_api_rate_limit_events (user_id, created_at)
  values (p_user_id, v_now);

  return true;
end;
$function$;

revoke all on function public.consume_tusk_chat_rate_limit(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_tusk_chat_rate_limit(uuid, integer, integer)
  to service_role;
