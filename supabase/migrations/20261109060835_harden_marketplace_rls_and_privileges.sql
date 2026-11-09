-- Harden the existing public-schema marketplace tables without changing user rows.
alter table public.listings
  add column if not exists status text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'listings_status_check'
      and conrelid = 'public.listings'::regclass
  ) then
    alter table public.listings
      add constraint listings_status_check
      check (status in ('active', 'inactive'));
  end if;
end $$;

alter table public.profiles
  alter column balance set default 0;

do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','listings','trades','live_prices','test_users')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

revoke all privileges on table
  public.profiles, public.listings, public.trades, public.live_prices, public.test_users
from anon, authenticated;

grant select on public.profiles to authenticated;
grant insert (id, phone, name) on public.profiles to authenticated;
grant update (id, phone, name) on public.profiles to authenticated;

create policy profiles_select_own
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_insert_own
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant select on public.listings to anon, authenticated;
grant insert (seller_id, category, product, location, price, seller, quantity, status)
  on public.listings to authenticated;
grant update (category, product, location, price, seller, quantity, status, updated_at)
  on public.listings to authenticated;
grant delete on public.listings to authenticated;

create policy listings_public_read
  on public.listings for select to anon, authenticated
  using (status = 'active' or (select auth.uid()) = seller_id
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('staff','admin'));

create policy listings_insert_owner
  on public.listings for insert to authenticated
  with check ((select auth.uid()) = seller_id);

create policy listings_update_owner
  on public.listings for update to authenticated
  using ((select auth.uid()) = seller_id)
  with check ((select auth.uid()) = seller_id);

create policy listings_update_staff
  on public.listings for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('staff','admin'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('staff','admin'));

create policy listings_delete_owner
  on public.listings for delete to authenticated
  using ((select auth.uid()) = seller_id);

create policy listings_delete_staff
  on public.listings for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('staff','admin'));

grant select, insert on public.trades to authenticated;

create policy trades_select_owner
  on public.trades for select to authenticated
  using ((select auth.uid()) = user_id);

create policy trades_select_staff
  on public.trades for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('staff','admin'));

create policy trades_insert_owner
  on public.trades for insert to authenticated
  with check ((select auth.uid()) = user_id);

grant select on public.live_prices to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (id, phone, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

create index if not exists listings_seller_id_idx on public.listings (seller_id);
