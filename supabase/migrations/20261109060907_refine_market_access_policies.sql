create policy live_prices_public_read
  on public.live_prices for select to anon, authenticated
  using (true);

drop policy if exists listings_update_owner on public.listings;
drop policy if exists listings_update_staff on public.listings;
create policy listings_update_owner_or_staff
  on public.listings for update to authenticated
  using (
    (select auth.uid()) = seller_id
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('staff','admin')
  )
  with check (
    (select auth.uid()) = seller_id
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('staff','admin')
  );

drop policy if exists listings_delete_owner on public.listings;
drop policy if exists listings_delete_staff on public.listings;
create policy listings_delete_owner_or_staff
  on public.listings for delete to authenticated
  using (
    (select auth.uid()) = seller_id
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('staff','admin')
  );

drop policy if exists trades_select_owner on public.trades;
drop policy if exists trades_select_staff on public.trades;
create policy trades_select_owner_or_staff
  on public.trades for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('staff','admin')
  );
