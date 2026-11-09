create policy api_rate_limits_deny_api
  on public.api_rate_limits for all to anon, authenticated
  using (false)
  with check (false);

alter table public.listings alter column quantity drop default;
