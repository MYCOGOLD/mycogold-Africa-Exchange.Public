create table if not exists public.api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, window_start)
);

alter table public.api_rate_limits enable row level security;
revoke all privileges on public.api_rate_limits from anon, authenticated, service_role;

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
  v_window_start timestamptz;
  v_count integer;
begin
  if p_user_id is null or p_limit < 1 or p_limit > 100
     or p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit arguments.';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limits(user_id, window_start, request_count)
  values (p_user_id, v_window_start, 1)
  on conflict (user_id, window_start)
  do update set request_count = public.api_rate_limits.request_count + 1
  returning request_count into v_count;

  delete from public.api_rate_limits
  where window_start < clock_timestamp() - interval '2 days';

  return v_count <= p_limit;
end;
$function$;

revoke all on function public.consume_listing_upload_limit(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_listing_upload_limit(uuid, integer, integer)
  to service_role;
