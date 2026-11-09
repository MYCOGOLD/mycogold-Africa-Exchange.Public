drop policy if exists trades_insert_owner on public.trades;
revoke insert, update, delete on public.trades from anon, authenticated;
grant select on public.trades to authenticated;
