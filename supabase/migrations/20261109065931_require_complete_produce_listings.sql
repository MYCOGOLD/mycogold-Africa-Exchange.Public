-- Listing completeness is enforced in the database, not only by the client form.
alter table public.listings
  alter column photo_url set not null,
  alter column location set not null,
  alter column seller set not null;

alter table public.listings
  add constraint listings_product_nonempty_check check (length(btrim(product)) > 0),
  add constraint listings_category_nonempty_check check (length(btrim(category)) > 0),
  add constraint listings_location_nonempty_check check (length(btrim(location)) > 0);
