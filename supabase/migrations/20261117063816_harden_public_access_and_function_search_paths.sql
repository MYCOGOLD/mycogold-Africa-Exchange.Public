-- Keep browser uploads behind /api/listings/photo, which validates and
-- re-encodes images before using a server-only Storage credential.
drop policy if exists produce_listings_insert_own_folder on storage.objects;
drop policy if exists produce_listings_update_own_folder on storage.objects;
revoke insert, update on storage.objects from public, anon, authenticated;
grant insert, update, select, delete on storage.objects to service_role;

-- Expose only fields required by the public marketplace. The base-table RLS
-- policy continues to enforce active-listing and owner visibility.
revoke select on public.listings from public, anon;
grant select (
  id,
  category,
  product,
  location,
  price,
  seller,
  quantity,
  created_at,
  updated_at,
  photo_path,
  variety,
  title,
  status
) on public.listings to anon;

create or replace view public.public_listings
with (security_invoker = true)
as
select
  id,
  category,
  product,
  location,
  price,
  seller,
  quantity,
  created_at,
  updated_at,
  photo_path,
  variety,
  title,
  status
from public.listings
where status = 'active';

grant select on public.public_listings to anon, authenticated;

-- Publish only the fixed, aggregate tokenomics fields. This replaces the
-- historical definer-view exposure with a parameterless, pinned function.
alter view public.mcg_tokenomics set (security_invoker = true);
revoke all on public.mcg_tokenomics from public, anon;
grant select on public.mcg_tokenomics to authenticated;

create or replace function public.get_public_mcg_tokenomics()
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'total_supply', 67000000::numeric,
    'minted', coalesce((select sum(l.amount) from public.mcg_ledger as l), 0)::numeric,
    'remaining', 67000000::numeric
      - coalesce((select sum(l.amount) from public.mcg_ledger as l), 0)::numeric,
    'holders', (select count(distinct l.user_id) from public.mcg_ledger as l),
    'total_awards', (select count(*) from public.mcg_ledger as l)
  );
$function$;

revoke all on function public.get_public_mcg_tokenomics() from public, anon, authenticated;
grant execute on function public.get_public_mcg_tokenomics() to anon, authenticated;

-- Staff access in database policies uses only trusted Auth app_metadata. The
-- server-only STAFF_USER_IDS allowlist is applied by API routes that use the
-- service role; it is never copied into client-controlled profile/JWT metadata.
drop policy if exists listings_select_staff on public.listings;
create policy listings_select_staff
  on public.listings for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('staff', 'admin'));

drop policy if exists listings_update_staff on public.listings;
create policy listings_update_staff
  on public.listings for update to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('staff', 'admin'))
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('staff', 'admin'));

-- Pin privileged functions to a closed search path and preserve their
-- service-role-only execution model.
create or replace function public.award_mcg(
  p_user_id uuid,
  p_amount numeric,
  p_reason text,
  p_trade_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_day_total numeric;
  v_prev_hash text;
  v_new_hash text;
  v_id uuid;
begin
  if p_amount <= 0 or p_amount > 50 then
    raise exception 'MCG amount must be 1-50';
  end if;

  if p_reason not in ('LIST_APPROVED', 'DELIVERY', 'QUALITY', 'REFERRAL', 'CONFIRM', 'PRICE_REPORT') then
    raise exception 'Invalid MCG reason';
  end if;

  select coalesce(sum(amount), 0) into v_day_total
  from public.mcg_ledger
  where user_id = p_user_id and created_at::date = current_date;

  if v_day_total + p_amount > 50 then
    raise exception 'Daily MCG cap 50 exceeded. Already earned % today', v_day_total;
  end if;

  if p_trade_id is not null and p_reason in ('DELIVERY', 'QUALITY', 'CONFIRM') then
    if not exists (select 1 from public.verified_trades where trade_id = p_trade_id) then
      raise exception 'Trade not verified - cannot award MCG';
    end if;
  end if;

  select entry_hash into v_prev_hash
  from public.mcg_ledger
  order by created_at desc limit 1;

  v_prev_hash := coalesce(v_prev_hash, 'GENESIS');

  v_new_hash := encode(
    extensions.digest(
      v_prev_hash || p_user_id::text || p_amount::text || p_reason
        || coalesce(p_trade_id, '') || now()::text,
      'sha256'
    ),
    'hex'
  );

  insert into public.mcg_ledger (user_id, amount, reason, trade_id, entry_hash, prev_hash)
  values (p_user_id, p_amount, p_reason, p_trade_id, v_new_hash, v_prev_hash)
  returning id into v_id;

  insert into public.mcg_balances as current_balance (user_id, balance, updated_at)
  values (p_user_id, p_amount, now())
  on conflict (user_id) do update set
    balance = current_balance.balance + excluded.balance,
    updated_at = now();

  return v_id;
end;
$function$;

alter function public.compute_mfpi_daily() set search_path = '';
alter function public.verify_trade_and_reward(text, text, numeric, numeric, numeric, uuid, uuid, text)
  set search_path = '';
alter function public.award_mcg(uuid, numeric, text, text) set search_path = '';

revoke all on function public.award_mcg(uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function public.compute_mfpi_daily() from public, anon, authenticated;
revoke all on function public.verify_trade_and_reward(text, text, numeric, numeric, numeric, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.award_mcg(uuid, numeric, text, text) to service_role;
grant execute on function public.compute_mfpi_daily() to service_role;
grant execute on function public.verify_trade_and_reward(text, text, numeric, numeric, numeric, uuid, uuid, text)
  to service_role;
