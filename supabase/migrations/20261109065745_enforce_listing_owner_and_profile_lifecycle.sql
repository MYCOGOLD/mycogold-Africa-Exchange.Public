-- A listing must always have an owning Auth user. Removing an account removes
-- its listings and profile; existing order references restrict deleting a user
-- while an order still exists.
alter table public.listings alter column seller_id set not null;
alter table public.listings drop constraint if exists listings_seller_id_fkey;
alter table public.listings
  add constraint listings_seller_id_fkey
  foreign key (seller_id) references auth.users(id) on delete cascade;

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
