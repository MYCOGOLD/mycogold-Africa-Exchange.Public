alter table public.listings
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.listings
  drop constraint if exists listings_coordinates_pair_check;

alter table public.listings
  add constraint listings_coordinates_pair_check
  check (
    (latitude is null and longitude is null)
    or (
      latitude is not null
      and longitude is not null
      and latitude between -90 and 90
      and longitude between -180 and 180
    )
  );

grant insert (seller_id, category, product, location, price, quantity, photo_path, status, latitude, longitude)
  on table public.listings to authenticated;

drop policy if exists listings_insert_owner on public.listings;
create policy listings_insert_owner
  on public.listings for insert to authenticated
  with check ((select auth.uid()) = seller_id and status = 'pending');

drop policy if exists listing_photo_delete_own_folder on storage.objects;
create policy listing_photo_delete_own_folder
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'produce-listings'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create or replace function public.verify_listing_photo_object()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.photo_path is null
     or new.photo_path !~ ('^' || new.seller_id::text || '/[^/]+$') then
    raise exception 'A photo from the seller-owned produce-listings folder is required.';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'produce-listings'
      and o.name = new.photo_path
      and o.is_delete_marker = false
  ) then
    raise exception 'The uploaded listing photo does not exist.';
  end if;

  return new;
end;
$function$;

revoke all on function public.verify_listing_photo_object() from public, anon, authenticated, service_role;

create or replace function public.prevent_delete_referenced_listing_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.bucket_id in ('produce-listings', 'listing-photos')
     and exists (
       select 1
       from public.listings l
       where l.photo_path = old.name
     ) then
    raise exception 'This photo is attached to a listing. Remove or replace the listing photo first.';
  end if;
  return old;
end;
$function$;

revoke all on function public.prevent_delete_referenced_listing_photo() from public, anon, authenticated, service_role;
