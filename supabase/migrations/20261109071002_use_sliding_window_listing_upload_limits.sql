create table if not exists public.api_rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp()
);

alter table public.api_rate_limit_events enable row level security;
revoke all privileges on public.api_rate_limit_events from anon, authenticated, service_role;

create policy api_rate_limit_events_deny_api
  on public.api_rate_limit_events for all to anon, authenticated
  using (false)
  with check (false);

create index if not exists api_rate_limit_events_user_created_idx
  on public.api_rate_limit_events (user_id, created_at desc);
create index if not exists api_rate_limit_events_created_idx
  on public.api_rate_limit_events (created_at);

create or replace function public.consume_listing_upload_limit(
  p_user_id uuid,
  p_limit integer default 10,
  p_window_seconds integer default 3600
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
  v_now timestamptz := clock_timestamp();
begin
  if p_user_id is null or p_limit < 1 or p_limit > 100
     or p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit arguments.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  delete from public.api_rate_limit_events
  where created_at < v_now - interval '2 days';

  select count(*)::integer
    into v_count
  from public.api_rate_limit_events e
  where e.user_id = p_user_id
    and e.created_at > v_now - (p_window_seconds * interval '1 second');

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.api_rate_limit_events(user_id, created_at)
  values (p_user_id, v_now);

  return true;
end;
$function$;

drop table if exists public.api_rate_limits;
