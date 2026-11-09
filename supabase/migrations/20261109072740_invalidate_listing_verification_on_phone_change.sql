create or replace function public.invalidate_listings_on_seller_phone_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.phone is distinct from old.phone then
    update public.listings
    set status = 'pending',
        seller_verified_at = null,
        moderated_at = null,
        updated_at = clock_timestamp()
    where seller_id = new.id
      and status = 'active';
  end if;
  return new;
end;
$function$;

revoke all on function public.invalidate_listings_on_seller_phone_change() from public, anon, authenticated, service_role;

drop trigger if exists profiles_invalidate_listing_verification on public.profiles;
create trigger profiles_invalidate_listing_verification
after update of phone on public.profiles
for each row execute function public.invalidate_listings_on_seller_phone_change();
