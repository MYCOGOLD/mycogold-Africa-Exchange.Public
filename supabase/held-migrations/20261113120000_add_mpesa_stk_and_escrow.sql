alter table public.orders
  add column if not exists delivered_at timestamptz,
  add column if not exists buyer_confirmed_at timestamptz,
  add column if not exists disputed_at timestamptz,
  add column if not exists dispute_reason text,
  add column if not exists escrow_released_at timestamptz;

alter table public.orders
  drop constraint if exists orders_status_check,
  add constraint orders_status_check
    check (status in ('requested', 'accepted', 'rejected', 'cancelled', 'PAID_ESCROW', 'DISPUTED', 'COMPLETED'));

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  amount_kes numeric(12, 2) not null check (amount_kes > 0),
  phone_number text not null,
  merchant_request_id text,
  checkout_request_id text unique,
  mpesa_receipt text unique,
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'FAILED')),
  result_code text,
  result_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_order_created_idx
  on public.payments (order_id, created_at desc);
create unique index if not exists payments_one_pending_attempt_per_order
  on public.payments (order_id)
  where status = 'PENDING';

alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;

drop policy if exists payments_select_participant on public.payments;
create policy payments_select_participant
  on public.payments for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id
      and ((select auth.uid()) = o.buyer_id or (select auth.uid()) = o.seller_id)
  ));

create or replace function public.enforce_order_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if new.buyer_id <> old.buyer_id
    or new.seller_id <> old.seller_id
    or new.listing_id <> old.listing_id
    or new.quantity <> old.quantity
    or new.unit_price <> old.unit_price
    or new.total_amount <> old.total_amount then
    raise exception 'Order terms are immutable after creation.';
  end if;

  if new.status = old.status then
    new.updated_at := now();
    return new;
  end if;

  if v_role = 'service_role'
    and ((old.status in ('requested', 'accepted') and new.status = 'PAID_ESCROW')
      or (old.status = 'PAID_ESCROW' and new.status in ('DISPUTED', 'COMPLETED'))) then
    new.updated_at := now();
    return new;
  end if;

  if old.status = 'requested'
    and new.status in ('rejected', 'cancelled')
    and exists (
      select 1 from public.payments p
      where p.order_id = old.id and p.status = 'PENDING'
    ) then
    raise exception 'An order with a pending M-Pesa payment cannot be rejected or cancelled.';
  end if;

  if old.status = 'PAID_ESCROW'
    and new.status = 'DISPUTED'
    and auth.uid() = old.buyer_id
    and old.buyer_confirmed_at is not null
    and new.disputed_at <= old.buyer_confirmed_at + interval '24 hours' then
    new.updated_at := now();
    return new;
  end if;

  if old.status <> 'requested'
    or new.status not in ('accepted', 'rejected', 'cancelled') then
    raise exception 'Invalid order status transition.';
  end if;
  if new.status in ('accepted', 'rejected') and auth.uid() <> old.seller_id then
    raise exception 'Only the seller may accept or reject an order.';
  end if;
  if new.status = 'cancelled' and auth.uid() <> old.buyer_id then
    raise exception 'Only the buyer may cancel an order.';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function public.enforce_order_status_transition() from public, anon, authenticated, service_role;

create or replace function public.prepare_order_request()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  listing_row record;
  actor_id uuid;
  reserved_quantity numeric;
begin
  actor_id := auth.uid();
  if actor_id is null then
    raise exception 'Authentication required to request an order.';
  end if;

  select l.id, l.seller_id, l.price, l.quantity, l.status
    into listing_row
  from public.listings l
  where l.id = new.listing_id
  for update;

  if not found or listing_row.status <> 'active' then
    raise exception 'Listing is not available for order requests.';
  end if;
  if listing_row.seller_id = actor_id then
    raise exception 'You cannot request your own listing.';
  end if;
  if new.quantity is null or new.quantity <= 0 then
    raise exception 'Requested quantity must be positive.';
  end if;

  select coalesce(sum(o.quantity), 0)
    into reserved_quantity
  from public.orders o
  where o.listing_id = new.listing_id
    and o.status not in ('rejected', 'cancelled');

  if reserved_quantity + new.quantity > listing_row.quantity then
    raise exception 'Not enough unreserved quantity remains for this request.';
  end if;

  new.buyer_id := actor_id;
  new.seller_id := listing_row.seller_id;
  new.unit_price := listing_row.price;
  new.total_amount := round(listing_row.price * new.quantity, 2);
  new.status := 'requested';
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function public.prepare_order_request() from public, anon, authenticated, service_role;

create or replace function public.apply_mpesa_stk_callback(
  p_checkout_request_id text,
  p_result_code text,
  p_result_description text,
  p_mpesa_receipt text,
  p_amount numeric
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_payment public.payments%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Trusted payment callback required.' using errcode = '42501';
  end if;

  select * into v_payment
  from public.payments
  where checkout_request_id = p_checkout_request_id
  for update;
  if not found then
    raise exception 'Payment attempt not found.';
  end if;
  if v_payment.status = 'PAID' then
    return 'PAID';
  end if;
  if v_payment.status <> 'PENDING' then
    return v_payment.status;
  end if;

  if p_result_code <> '0' then
    update public.payments
      set status = 'FAILED', result_code = p_result_code,
          result_description = left(coalesce(p_result_description, 'Payment failed.'), 500),
          updated_at = now()
    where id = v_payment.id;
    return 'FAILED';
  end if;

  if p_mpesa_receipt is null or length(trim(p_mpesa_receipt)) = 0
     or p_amount is null or p_amount <> v_payment.amount_kes then
    raise exception 'Payment callback receipt or amount does not match the STK request.';
  end if;

  update public.payments
    set status = 'PAID', mpesa_receipt = trim(p_mpesa_receipt),
        result_code = p_result_code,
        result_description = left(coalesce(p_result_description, 'Payment received.'), 500),
        updated_at = now()
  where id = v_payment.id;

  update public.orders
    set status = 'PAID_ESCROW', updated_at = now()
  where id = v_payment.order_id and status in ('requested', 'accepted');
  if not found then
    raise exception 'Order is not in a payable state.';
  end if;

  return 'PAID_ESCROW';
end;
$function$;

revoke all on function public.apply_mpesa_stk_callback(text, text, text, text, numeric) from public, anon, authenticated;
grant execute on function public.apply_mpesa_stk_callback(text, text, text, text, numeric) to service_role;

create or replace function public.mark_order_delivered(p_order_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_delivered_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.orders
    set delivered_at = coalesce(delivered_at, now()), updated_at = now()
  where id = p_order_id and seller_id = auth.uid() and status = 'PAID_ESCROW'
  returning delivered_at into v_delivered_at;
  if not found then
    raise exception 'Only the seller may mark a paid escrow order delivered.';
  end if;
  return v_delivered_at;
end;
$function$;

revoke all on function public.mark_order_delivered(uuid) from public, anon;
grant execute on function public.mark_order_delivered(uuid) to authenticated, service_role;

create or replace function public.confirm_order_delivery(p_order_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_confirmed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.orders
    set buyer_confirmed_at = now(), updated_at = now()
  where id = p_order_id
    and buyer_id = auth.uid()
    and status = 'PAID_ESCROW'
    and delivered_at is not null
    and buyer_confirmed_at is null
    and escrow_released_at is null
  returning buyer_confirmed_at into v_confirmed_at;
  if not found then
    raise exception 'Order is not ready for buyer delivery confirmation.';
  end if;
  return v_confirmed_at;
end;
$function$;

revoke all on function public.confirm_order_delivery(uuid) from public, anon;
grant execute on function public.confirm_order_delivery(uuid) to authenticated;

create or replace function public.dispute_order(p_order_id uuid, p_reason text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_disputed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A dispute reason is required.';
  end if;

  update public.orders
    set status = 'DISPUTED', disputed_at = now(), dispute_reason = left(trim(p_reason), 1000), updated_at = now()
  where id = p_order_id
    and buyer_id = auth.uid()
    and status = 'PAID_ESCROW'
    and buyer_confirmed_at is not null
    and now() <= buyer_confirmed_at + interval '24 hours'
    and escrow_released_at is null
  returning disputed_at into v_disputed_at;
  if not found then
    raise exception 'The order is not eligible for a dispute or the 24-hour window has closed.';
  end if;
  return v_disputed_at;
end;
$function$;

revoke all on function public.dispute_order(uuid, text) from public, anon;
grant execute on function public.dispute_order(uuid, text) to authenticated;

create or replace function public.release_order_escrow(p_order_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_released_at timestamptz;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Admin escrow release authorization required.' using errcode = '42501';
  end if;

  update public.orders
    set status = 'COMPLETED', escrow_released_at = now(), updated_at = now()
  where id = p_order_id
    and status = 'PAID_ESCROW'
    and delivered_at is not null
    and buyer_confirmed_at <= now() - interval '24 hours'
    and disputed_at is null
    and escrow_released_at is null
  returning escrow_released_at into v_released_at;
  if not found then
    raise exception 'Escrow cannot be released before delivery confirmation and the 24-hour dispute window.';
  end if;
  return v_released_at;
end;
$function$;

revoke all on function public.release_order_escrow(uuid) from public, anon, authenticated;
grant execute on function public.release_order_escrow(uuid) to service_role;