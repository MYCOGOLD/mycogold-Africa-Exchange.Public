create table if not exists public.reference_prices (
  id uuid primary key default gen_random_uuid(),
  product text not null,
  category text,
  unit text not null,
  wholesale_price numeric,
  retail_price numeric,
  wholesale_unit text,
  source text,
  reference_date date not null default '2026-11-08',
  created_at timestamptz default now()
);

alter table public.reference_prices enable row level security;
drop policy if exists "reference prices are public" on public.reference_prices;
create policy "reference prices are public" on public.reference_prices for select to anon, authenticated using (true);

insert into public.reference_prices (product, category, unit, wholesale_price, retail_price, wholesale_unit, source, reference_date) values
('Beef Fresh on bone','Beef','1kg',650,780,'Wakulima / Farmgate','KNBS / KAMIS / Butchery','2026-11-08'),
('Beef Fillet/Steak','Beef','1kg',900,1250,'Wakulima / Farmgate','KNBS / KAMIS / Butchery','2026-11-08'),
('Beef Matumbo','Beef','1kg',350,400,'Wakulima / Farmgate','KNBS / KAMIS / Butchery','2026-11-08'),
('Mushroom Button White','Mushroom','1kg',350,600,'Wakulima / Farmgate','KAMIS / Farmers Trend','2026-11-08'),
('Mushroom Oyster Fresh','Mushroom','1kg',350,400,'Wakulima / Farmgate','KAMIS / Farmers Trend','2026-11-08'),
('Mushroom Dried Oyster','Mushroom','1kg',2000,2600,'Wakulima / Farmgate','KAMIS / Farmers Trend','2026-11-08'),
('Mushroom Spawn','Mushroom','1kg',600,1000,'Wakulima / Farmgate','KAMIS / Farmers Trend','2026-11-08'),
('Irish Potatoes','Potatoes','1kg',58,70,'Wakulima / Farmgate','KNBS / KAMIS','2026-11-08'),
('Onions Red','Onions','1kg',80,122.37,'Wakulima / Farmgate','KNBS / KAMIS','2026-11-08'),
('Kales Sukuma Wiki','Kales','1kg',30,83.32,'Wakulima / Farmgate','KNBS / KAMIS','2026-11-08'),
('Cabbage','Cabbage','1kg',16,82.38,'Wakulima / Farmgate','KNBS / KAMIS','2026-11-08'),
('Cereals Dry Maize','Cereals','1kg',70,74,'Wakulima / Farmgate','KNBS / KAMIS','2026-11-08'),
('Cereals Beans Rose Coco','Cereals','1kg',168,185.75,'Wakulima / Farmgate','KNBS / KAMIS','2026-11-08'),
('Cereals Green Grams Ndengu','Cereals','1kg',190,210,'Wakulima / Farmgate','KNBS / KAMIS','2026-11-08'),
('Milk Raw Unpacketed','Milk','1 litre',50,80.58,'Wakulima / Farmgate','KNBS / KAMIS','2026-11-08'),
('Milk Packeted','Milk','500ml',55,64.13,'Wakulima / Farmgate','KNBS / KAMIS','2026-11-08'),
('Eggs Poultry','Eggs','Tray 30',380,450,'Wakulima / Farmgate','KNBS / KAMIS','2026-11-08');
