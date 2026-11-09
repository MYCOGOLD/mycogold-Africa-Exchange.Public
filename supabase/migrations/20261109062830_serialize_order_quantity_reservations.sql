-- Serialize requests per listing and prevent over-reservation under concurrent requests.
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

  select coalesce(sum(o.quantity),0)
    into reserved_quantity
  from public.orders o
  where o.listing_id = new.listing_id
    and o.status in ('requested','accepted');

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
