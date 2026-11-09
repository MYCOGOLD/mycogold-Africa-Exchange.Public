-- Keep legacy/test tables explicitly inaccessible to browser API roles.
create policy test_users_deny_api
  on public.test_users for all to anon, authenticated
  using (false)
  with check (false);

create policy live_prices_deny_api
  on public.live_prices for all to anon, authenticated
  using (false)
  with check (false);
