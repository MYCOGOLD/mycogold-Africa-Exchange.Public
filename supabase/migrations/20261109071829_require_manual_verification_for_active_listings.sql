alter table public.listings
  drop constraint if exists listings_active_requires_manual_verification;
alter table public.listings
  add constraint listings_active_requires_manual_verification
  check (
    (status = 'active' and seller_verified_at is not null)
    or (status <> 'active' and seller_verified_at is null)
  );
