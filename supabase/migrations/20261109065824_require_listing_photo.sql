-- A listing must have a photo uploaded through the authenticated server route.
alter table public.listings
  drop constraint if exists listings_photo_url_required;
alter table public.listings
  add constraint listings_photo_url_required
  check (photo_url is not null and length(trim(photo_url)) > 0);
