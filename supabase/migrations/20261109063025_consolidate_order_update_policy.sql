drop policy if exists orders_seller_respond on public.orders;
drop policy if exists orders_buyer_cancel on public.orders;

create policy orders_participant_update_request
  on public.orders for update to authenticated
  using (
    (select auth.uid()) = seller_id and status = 'requested'
    or (select auth.uid()) = buyer_id and status = 'requested'
  )
  with check (
    ((select auth.uid()) = seller_id and status in ('accepted','rejected'))
    or ((select auth.uid()) = buyer_id and status = 'cancelled')
  );
