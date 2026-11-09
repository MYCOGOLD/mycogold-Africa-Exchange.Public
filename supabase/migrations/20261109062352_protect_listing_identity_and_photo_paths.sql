-- Derive public seller display labels from the seller's profile; do not trust browser input.
revoke insert (seller) on public.listings from authenticated;
revoke update (seller, updated_at) on public.listings from authenticated;

create or replace function public.sync_listing_seller_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  select coalesce(p.name, 'Seller')
    into new.seller
  from public.profiles p
  where p.id = new.seller_id;

  if new.seller is null then
    new.seller := 'Seller';
  end if;

  return new;
end;
$function$;

revoke all on function public.sync_listing_seller_name() from public, anon, authenticated, service_role;

drop trigger if exists listings_sync_seller_name on public.listings;
create trigger listings_sync_seller_name
before insert or update of seller_id on public.listings
for each row execute function public.sync_listing_seller_name();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'listings_photo_url_own_bucket_check'
      and conrelid = 'public.listings'::regclass
  ) then
    alter table public.listings
      add constraint listings_photo_url_own_bucket_check
      check (
        photo_url is null
        or (
          seller_id is not null
          and photo_url like
            'https://vuwqmuficrrcseoovsnn.supabase.co/storage/v1/object/public/produce-listings/'
            || seller_id::text || '/%'
        )
      );
  end if;
end $$;
