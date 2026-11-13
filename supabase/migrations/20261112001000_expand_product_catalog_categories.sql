alter table public.product_catalog
  drop constraint if exists product_catalog_category_check;

alter table public.product_catalog
  add constraint product_catalog_category_check
  check (category in ('Mushroom','Potatoes','Onions','Kales','Cabbage','Cereals','Beef','Tomato','Carrot','Spinach'));

insert into public.product_catalog (category, variety)
values
  ('Mushroom', 'White Button'),
  ('Mushroom', 'Oyster'),
  ('Mushroom', 'Cremini'),
  ('Mushroom', 'Portobello'),
  ('Mushroom', 'Shiitake'),
  ('Kales', 'Sukuma Wiki'),
  ('Kales', 'Collard Greens'),
  ('Kales', 'Kale - Curly'),
  ('Cabbage', 'Green Cabbage'),
  ('Cabbage', 'Red Cabbage'),
  ('Cabbage', 'Chinese Cabbage'),
  ('Beef', 'Beef - Fresh'),
  ('Beef', 'Beef - Dried'),
  ('Beef', 'Beef - Minced'),
  ('Potatoes', 'Irish Potato'),
  ('Potatoes', 'Sweet Potato'),
  ('Onions', 'Red Onions'),
  ('Onions', 'White Onions'),
  ('Onions', 'Spring Onions'),
  ('Tomato', 'Tomato - Roma'),
  ('Tomato', 'Tomato - Beefsteak'),
  ('Carrot', 'Carrot'),
  ('Spinach', 'Spinach'),
  ('Cereals', 'Maize'),
  ('Cereals', 'Beans'),
  ('Cereals', 'Rice')
on conflict (category, variety) do nothing;