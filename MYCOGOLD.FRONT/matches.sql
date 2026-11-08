create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid,
  seller_id uuid,
  listing_id uuid references public.listings(id) on delete cascade,
  match_score numeric not null,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz default now()
);
alter table public.matches enable row level security;
drop policy if exists "matches are readable" on public.matches;
create policy "matches are readable" on public.matches for select to anon, authenticated using (true);
drop policy if exists "matches can be requested" on public.matches;
create policy "matches can be requested" on public.matches for insert to authenticated with check (true);
