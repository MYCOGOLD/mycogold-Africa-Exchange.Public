create or replace view public.mcg_tokenomics as
select
  67000000::numeric as total_supply,
  coalesce((select sum(amount) from public.mcg_ledger), 0)::numeric as minted,
  67000000::numeric - coalesce((select sum(amount) from public.mcg_ledger), 0)::numeric as remaining,
  (select count(distinct user_id) from public.mcg_ledger)::bigint as holders,
  (select count(*) from public.mcg_ledger)::bigint as total_awards;

grant select on public.mcg_tokenomics to authenticated;