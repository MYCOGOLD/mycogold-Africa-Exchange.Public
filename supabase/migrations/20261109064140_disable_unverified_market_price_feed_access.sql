-- The legacy price feed contains synthetic/demo values and is not yet backed by
-- verified observations. Keep it private until a provenance-checked pipeline exists.
drop policy if exists live_prices_public_read on public.live_prices;
revoke select on public.live_prices from anon, authenticated;
