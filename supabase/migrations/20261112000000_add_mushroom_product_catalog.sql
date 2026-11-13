create table if not exists public.product_catalog (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  variety text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint product_catalog_category_check
    check (category in ('Mushroom','Potatoes','Onions','Kales','Cabbage','Cereals','Beef')),
  constraint product_catalog_variety_check
    check (length(btrim(variety)) between 1 and 80),
  constraint product_catalog_category_variety_key unique (category, variety)
);

alter table public.product_catalog enable row level security;
revoke all privileges on table public.product_catalog from anon, authenticated;
grant select on table public.product_catalog to authenticated;
grant insert (category, variety, created_by) on table public.product_catalog to authenticated;

drop policy if exists product_catalog_authenticated_read on public.product_catalog;
create policy product_catalog_authenticated_read
  on public.product_catalog for select to authenticated
  using (true);

drop policy if exists product_catalog_insert_owner on public.product_catalog;
create policy product_catalog_insert_owner
  on public.product_catalog for insert to authenticated
  with check ((select auth.uid()) = created_by);

insert into public.product_catalog (category, variety)
values
  ('Mushroom', 'Button'),
  ('Mushroom', 'Cremini'),
  ('Mushroom', 'Enoki'),
  ('Mushroom', 'Lion''s Mane'),
  ('Mushroom', 'Oyster'),
  ('Mushroom', 'Portobello'),
  ('Mushroom', 'Shiitake')
on conflict (category, variety) do nothing;