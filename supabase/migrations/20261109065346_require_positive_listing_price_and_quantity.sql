-- The marketplace listing form requires positive price and quantity. Enforce
-- the same invariant at the database boundary, not only in the browser.
alter table public.listings drop constraint if exists listings_price_check;
alter table public.listings add constraint listings_price_check check (price > 0);

alter table public.listings drop constraint if exists listings_quantity_check;
alter table public.listings add constraint listings_quantity_check check (quantity > 0);
