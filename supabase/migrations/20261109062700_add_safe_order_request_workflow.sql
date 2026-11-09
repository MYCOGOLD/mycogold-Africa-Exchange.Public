-- Safe order requests only. No wallet debit, payment, escrow, or settlement occurs here.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  buyer_id uuid not null references auth.users(id) on delete restrict,
  seller_id uuid not null references auth.users(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null check (unit_price > 0),
  total_amount numeric not null check (total_amount > 0),
  status text not null default 'requested'
    check (status in ('requested','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create or replace function public.prepare_order_request()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  listing_row record;
  actor_id uuid;
begin
  actor_id := auth.uid();
  if actor_id is null then
    raise exception 'Authentication required to request an order.';
  end if;

  select l.id, l.seller_id, l.price, l.quantity, l.status
    into listing_row
  from public.listings l
  where l.id = new.listing_id
  for share;

  if not found or listing_row.status <> 'active' then
    raise exception 'Listing is not available for order requests.';
  end if;
  if listing_row.seller_id = actor_id then
    raise exception 'You cannot request your own listing.';
  end if;
  if new.quantity is null or new.quantity <= 0 or new.quantity > listing_row.quantity then
    raise exception 'Requested quantity must be positive and no greater than available quantity.';
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

drop trigger if exists orders_prepare_request on public.orders;
create trigger orders_prepare_request
before insert on public.orders
for each row execute function public.prepare_order_request();

create or replace function public.enforce_order_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
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
    new.updated_at := old.updated_at;
    return new;
  end if;
  if old.status <> 'requested' then
    raise exception 'This order can no longer be changed.';
  end if;
  if new.status not in ('accepted','rejected','cancelled') then
    raise exception 'Invalid order status transition.';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function public.enforce_order_status_transition() from public, anon, authenticated, service_role;

drop trigger if exists orders_enforce_transition on public.orders;
create trigger orders_enforce_transition
before update on public.orders
for each row execute function public.enforce_order_status_transition();

revoke all privileges on public.orders from anon, authenticated;
grant select on public.orders to authenticated;
grant insert (listing_id, quantity) on public.orders to authenticated;
grant update (status) on public.orders to authenticated;

drop policy if exists orders_read_participant on public.orders;
create policy orders_read_participant
  on public.orders for select to authenticated
  using ((select auth.uid()) = buyer_id or (select auth.uid()) = seller_id);

drop policy if exists orders_create_buyer_request on public.orders;
create policy orders_create_buyer_request
  on public.orders for insert to authenticated
  with check ((select auth.uid()) = buyer_id and status = 'requested');

drop policy if exists orders_seller_respond on public.orders;
create policy orders_seller_respond
  on public.orders for update to authenticated
  using ((select auth.uid()) = seller_id and status = 'requested')
  with check ((select auth.uid()) = seller_id and status in ('accepted','rejected'));

drop policy if exists orders_buyer_cancel on public.orders;
create policy orders_buyer_cancel
  on public.orders for update to authenticated
  using ((select auth.uid()) = buyer_id and status = 'requested')
  with check ((select auth.uid()) = buyer_id and status = 'cancelled');

create index if not exists orders_buyer_created_idx on public.orders (buyer_id, created_at desc);
create index if not exists orders_seller_created_idx on public.orders (seller_id, created_at desc);
create index if not exists orders_listing_idx on public.orders (listing_id);
