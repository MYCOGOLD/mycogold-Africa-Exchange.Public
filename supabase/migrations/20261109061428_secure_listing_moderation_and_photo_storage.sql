alter table public.listings
  add column if not exists photo_url text,
  add column if not exists verified_at timestamptz,
  add column if not exists tusk_status text not null default 'pending',
  add column if not exists network_stamp text;

alter table public.listings alter column status set default 'pending';
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings
  add constraint listings_status_check
  check (status in ('pending','active','inactive'));

revoke insert, update on public.listings from authenticated;
grant select, delete on public.listings to authenticated;
grant insert (seller_id, category, product, location, price, seller, quantity, photo_url)
  on public.listings to authenticated;
grant update (category, product, location, price, seller, quantity, photo_url, updated_at)
  on public.listings to authenticated;

drop policy if exists listings_insert_owner on public.listings;
create policy listings_insert_owner
  on public.listings for insert to authenticated
  with check ((select auth.uid()) = seller_id and status = 'pending');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produce-listings','produce-listings',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists produce_listing_upload_own_folder on storage.objects;
create policy produce_listing_upload_own_folder
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'produce-listings'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists produce_listing_delete_own_folder on storage.objects;
create policy produce_listing_delete_own_folder
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'produce-listings'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
