-- Prevent sellers from reducing advertised quantity below active order reservations.
create or replace function public.prevent_listing_oversell()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  reserved_quantity numeric;
begin
  if new.quantity < old.quantity then
    select coalesce(sum(o.quantity),0)
      into reserved_quantity
    from public.orders o
    where o.listing_id = old.id
      and o.status in ('requested','accepted');

    if new.quantity < reserved_quantity then
      raise exception 'Available quantity cannot be reduced below requested or accepted order quantities.';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.prevent_listing_oversell() from public, anon, authenticated, service_role;

drop trigger if exists listings_prevent_oversell on public.listings;
create trigger listings_prevent_oversell
before update of quantity on public.listings
for each row execute function public.prevent_listing_oversell();

grant all privileges on public.orders to service_role;
