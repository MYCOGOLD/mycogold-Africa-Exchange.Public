-- Reject listings whose photo URL does not resolve to an uploaded object in
-- the seller's own folder in the dedicated public produce-listings bucket.
create or replace function public.verify_listing_photo_object()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  object_path text;
  expected_prefix constant text :=
    'https://vuwqmuficrrcseoovsnn.supabase.co/storage/v1/object/public/produce-listings/';
begin
  if new.photo_url is null or left(new.photo_url, length(expected_prefix)) <> expected_prefix then
    raise exception 'A photo from the produce-listings bucket is required.';
  end if;

  object_path := substring(new.photo_url from length(expected_prefix) + 1);
  if object_path !~ ('^' || new.seller_id::text || '/[^/]+$') then
    raise exception 'Listing photos must be stored in the seller-owned folder.';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'produce-listings'
      and o.name = object_path
      and o.is_delete_marker = false
  ) then
    raise exception 'The uploaded listing photo does not exist.';
  end if;

  return new;
end;
$function$;

revoke all on function public.verify_listing_photo_object() from public, anon, authenticated, service_role;

drop trigger if exists listings_verify_photo_object on public.listings;
create trigger listings_verify_photo_object
before insert or update of photo_url, seller_id on public.listings
for each row execute function public.verify_listing_photo_object();
