drop trigger if exists listings_verify_photo_object on public.listings;
drop function if exists public.verify_listing_photo_object();

alter table public.listings rename column photo_url to photo_path;

alter table public.listings drop constraint if exists listings_photo_url_own_bucket_check;
alter table public.listings drop constraint if exists listings_photo_url_required;
alter table public.listings drop constraint if exists listings_photo_path_required;
alter table public.listings drop constraint if exists listings_photo_path_owner_check;

alter table public.listings
  add constraint listings_photo_path_required
  check (photo_path is not null and length(trim(photo_path)) > 0);

alter table public.listings
  add constraint listings_photo_path_owner_check
  check (
    seller_id is not null
    and photo_path ~ ('^' || seller_id::text || '/[^/]+$')
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

create trigger listings_verify_photo_object
before insert or update of photo_path, seller_id on public.listings
for each row execute function public.verify_listing_photo_object();
