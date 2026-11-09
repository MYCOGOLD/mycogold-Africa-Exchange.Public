drop policy if exists listings_public_read on public.listings;
create policy listings_public_read
  on public.listings for select to anon, authenticated
  using (
    status = 'active'
    or (select auth.uid()) = seller_id
    or ((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('staff','admin')
  );

drop policy if exists listings_update_owner_or_staff on public.listings;
create policy listings_update_owner_or_staff
  on public.listings for update to authenticated
  using (
    (select auth.uid()) = seller_id
    or ((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('staff','admin')
  )
  with check (
    (select auth.uid()) = seller_id
    or ((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('staff','admin')
  );

drop policy if exists listings_delete_owner_or_staff on public.listings;
create policy listings_delete_owner_or_staff
  on public.listings for delete to authenticated
  using (
    (select auth.uid()) = seller_id
    or ((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('staff','admin')
  );

drop policy if exists trades_select_owner_or_staff on public.trades;
create policy trades_select_owner_or_staff
  on public.trades for select to authenticated
  using (
    (select auth.uid()) = user_id
    or ((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('staff','admin')
  );
