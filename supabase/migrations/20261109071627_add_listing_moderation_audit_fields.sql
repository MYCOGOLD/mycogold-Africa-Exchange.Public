alter table public.listings
  add column if not exists moderated_at timestamptz,
  add column if not exists seller_verified_at timestamptz;
