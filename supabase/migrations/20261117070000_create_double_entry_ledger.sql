-- Additive general ledger. Existing mcg_ledger/mcg_balances remain the historic
-- MCG rewards subsystem; they are not treated as a KES-capable accounting ledger.
create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  account_code text not null,
  name text not null,
  asset_code text not null check (asset_code in ('KES', 'MCG')),
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'income', 'expense')),
  owner_user_id uuid references auth.users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (asset_code, account_code)
);

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  request_hash text not null,
  reference_type text not null,
  reference_id text,
  memo text not null,
  reversal_of uuid unique references public.ledger_transactions(id),
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.ledger_entries (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.ledger_transactions(id),
  account_id uuid not null references public.ledger_accounts(id),
  asset_code text not null check (asset_code in ('KES', 'MCG')),
  side text not null check (side in ('debit', 'credit')),
  amount numeric(24, 8) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index ledger_entries_transaction_idx on public.ledger_entries(transaction_id);
create index ledger_entries_account_asset_idx on public.ledger_entries(account_id, asset_code);

alter table public.ledger_accounts enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.ledger_entries enable row level security;
revoke all on public.ledger_accounts, public.ledger_transactions, public.ledger_entries from public, anon, authenticated;
grant select on public.ledger_accounts, public.ledger_transactions, public.ledger_entries to service_role;
grant insert, select, update on public.ledger_accounts to service_role;
grant usage, select on sequence public.ledger_entries_id_seq to service_role;

create or replace function public.ledger_reject_mutation()
returns trigger language plpgsql set search_path = '' as $function$
begin
  raise exception 'Ledger rows are immutable; post a reversal instead';
end;
$function$;

create trigger ledger_transactions_immutable
before update or delete on public.ledger_transactions
for each row execute function public.ledger_reject_mutation();
create trigger ledger_entries_immutable
before update or delete on public.ledger_entries
for each row execute function public.ledger_reject_mutation();

create or replace function public.ledger_check_transaction_balance()
returns trigger language plpgsql set search_path = '' as $function$
declare
  v_transaction_id uuid;
begin
  if tg_table_name = 'ledger_transactions' then
    v_transaction_id := new.id;
  else
    v_transaction_id := coalesce(new.transaction_id, old.transaction_id);
  end if;
  if exists (
    select 1 from public.ledger_transactions t
    where t.id = v_transaction_id
      and not exists (select 1 from public.ledger_entries e where e.transaction_id = t.id)
  ) then
    raise exception 'Ledger transaction % has no entries', v_transaction_id;
  end if;
  if exists (
    select e.asset_code from public.ledger_entries e
    where e.transaction_id = v_transaction_id
    group by e.asset_code
    having sum(case when e.side = 'debit' then e.amount else 0 end)
        <> sum(case when e.side = 'credit' then e.amount else 0 end)
  ) then
    raise exception 'Ledger transaction % is not balanced per asset', v_transaction_id;
  end if;
  if exists (
    select 1 from public.ledger_entries e
    join public.ledger_accounts a on a.id = e.account_id
    where e.transaction_id = v_transaction_id and e.asset_code <> a.asset_code
  ) then
    raise exception 'Ledger entry asset does not match its account';
  end if;
  return null;
end;
$function$;

-- Check the parent transaction too: otherwise a transaction inserted with
-- zero entries would never fire the entry-side constraint trigger.
create constraint trigger ledger_transactions_must_balance
after insert on public.ledger_transactions
deferrable initially deferred
for each row execute function public.ledger_check_transaction_balance();

create constraint trigger ledger_entries_must_balance
after insert on public.ledger_entries
deferrable initially deferred
for each row execute function public.ledger_check_transaction_balance();

create or replace function public.post_ledger_transaction(
  p_idempotency_key text,
  p_reference_type text,
  p_reference_id text,
  p_memo text,
  p_lines jsonb,
  p_reversal_of uuid default null
)
returns uuid
language plpgsql security definer set search_path = '' as $function$
declare
  v_hash text;
  v_id uuid;
  v_existing_hash text;
  v_line jsonb;
  v_account public.ledger_accounts%rowtype;
  v_asset text;
  v_side text;
  v_amount numeric;
begin
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 8 and 200
     or p_reference_type is null or length(btrim(p_reference_type)) not between 1 and 80
     or p_memo is null or length(btrim(p_memo)) not between 1 and 500 then
    raise exception 'Invalid ledger transaction request';
  end if;
  -- IS DISTINCT FROM also rejects SQL NULL. Keep array-length evaluation
  -- separate so malformed JSON types cannot slip through SQL three-valued logic.
  if p_lines is null or jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'Ledger lines must be a JSON array';
  end if;
  if jsonb_array_length(p_lines) < 2 or jsonb_array_length(p_lines) > 100 then
    raise exception 'Ledger transaction must contain between 2 and 100 lines';
  end if;
  v_hash := encode(extensions.digest(
    jsonb_build_object('reference_type', p_reference_type, 'reference_id', p_reference_id,
      'memo', p_memo, 'lines', p_lines, 'reversal_of', p_reversal_of)::text,
    'sha256'), 'hex');

  insert into public.ledger_transactions
    (idempotency_key, request_hash, reference_type, reference_id, memo, reversal_of, created_by)
  values (p_idempotency_key, v_hash, p_reference_type, p_reference_id, p_memo, p_reversal_of, auth.uid())
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id, request_hash into v_id, v_existing_hash
      from public.ledger_transactions where idempotency_key = p_idempotency_key;
    if v_existing_hash <> v_hash then
      raise exception 'Idempotency key reused with different ledger content';
    end if;
    return v_id;
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(v_line) is distinct from 'object'
       or coalesce(v_line ->> 'asset', '') not in ('KES', 'MCG')
       or coalesce(v_line ->> 'side', '') not in ('debit', 'credit')
       or coalesce(v_line ->> 'account_code', '') !~ '^[A-Za-z0-9_.:-]{1,64}
    select * into v_account from public.ledger_accounts
      where asset_code = v_asset and account_code = v_line ->> 'account_code' and is_active;
    if not found then raise exception 'Unknown or inactive ledger account'; end if;
    insert into public.ledger_entries(transaction_id, account_id, asset_code, side, amount)
      values (v_id, v_account.id, v_asset, v_side, v_amount);
  end loop;

  if p_reversal_of is not null and not exists (
    select 1 from public.ledger_transactions where id = p_reversal_of
  ) then
    raise exception 'Reversed transaction does not exist';
  end if;
  if p_reversal_of is not null and exists (
    (select a.account_code, e.asset_code, e.side,
        sum(e.amount)::numeric(24, 8) as amount
     from public.ledger_entries e join public.ledger_accounts a on a.id = e.account_id
     where e.transaction_id = v_id group by a.account_code, e.asset_code, e.side
     except
     select a.account_code, e.asset_code,
        case e.side when 'debit' then 'credit' else 'debit' end,
        sum(e.amount)::numeric(24, 8)
     from public.ledger_entries e join public.ledger_accounts a on a.id = e.account_id
     where e.transaction_id = p_reversal_of group by a.account_code, e.asset_code, e.side)
    union all
    (select a.account_code, e.asset_code,
        case e.side when 'debit' then 'credit' else 'debit' end,
        sum(e.amount)::numeric(24, 8)
     from public.ledger_entries e join public.ledger_accounts a on a.id = e.account_id
     where e.transaction_id = p_reversal_of group by a.account_code, e.asset_code, e.side
     except
     select a.account_code, e.asset_code, e.side,
        sum(e.amount)::numeric(24, 8)
     from public.ledger_entries e join public.ledger_accounts a on a.id = e.account_id
     where e.transaction_id = v_id group by a.account_code, e.asset_code, e.side)
  ) then
    raise exception 'A reversal must exactly invert the referenced transaction';
  end if;
  return v_id;
end;
$function$;

revoke all on function public.ledger_reject_mutation() from public, anon, authenticated;
revoke all on function public.ledger_check_transaction_balance() from public, anon, authenticated;
revoke all on function public.post_ledger_transaction(text, text, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.post_ledger_transaction(text, text, text, text, jsonb, uuid) to service_role;

create or replace view public.ledger_account_balances
with (security_invoker = true)
as
select a.id, a.account_code, a.name, a.asset_code, a.account_type, a.owner_user_id,
  coalesce(sum(case when e.side = 'debit' then e.amount else -e.amount end), 0) as net_debits,
  count(e.id) as entry_count
from public.ledger_accounts a
left join public.ledger_entries e on e.account_id = a.id
group by a.id;
revoke all on public.ledger_account_balances from public, anon, authenticated;
grant select on public.ledger_account_balances to service_role;

       or coalesce(v_line ->> 'amount', '') !~ '^[0-9]{1,16}(\\.[0-9]{1,8})?
    select * into v_account from public.ledger_accounts
      where asset_code = v_asset and account_code = v_line ->> 'account_code' and is_active;
    if not found then raise exception 'Unknown or inactive ledger account'; end if;
    insert into public.ledger_entries(transaction_id, account_id, asset_code, side, amount)
      values (v_id, v_account.id, v_asset, v_side, v_amount);
  end loop;

  if p_reversal_of is not null and not exists (
    select 1 from public.ledger_transactions where id = p_reversal_of
  ) then
    raise exception 'Reversed transaction does not exist';
  end if;
  if p_reversal_of is not null and exists (
    (select a.account_code, e.asset_code, e.side,
        sum(e.amount)::numeric(24, 8) as amount
     from public.ledger_entries e join public.ledger_accounts a on a.id = e.account_id
     where e.transaction_id = v_id group by a.account_code, e.asset_code, e.side
     except
     select a.account_code, e.asset_code,
        case e.side when 'debit' then 'credit' else 'debit' end,
        sum(e.amount)::numeric(24, 8)
     from public.ledger_entries e join public.ledger_accounts a on a.id = e.account_id
     where e.transaction_id = p_reversal_of group by a.account_code, e.asset_code, e.side)
    union all
    (select a.account_code, e.asset_code,
        case e.side when 'debit' then 'credit' else 'debit' end,
        sum(e.amount)::numeric(24, 8)
     from public.ledger_entries e join public.ledger_accounts a on a.id = e.account_id
     where e.transaction_id = p_reversal_of group by a.account_code, e.asset_code, e.side
     except
     select a.account_code, e.asset_code, e.side,
        sum(e.amount)::numeric(24, 8)
     from public.ledger_entries e join public.ledger_accounts a on a.id = e.account_id
     where e.transaction_id = v_id group by a.account_code, e.asset_code, e.side)
  ) then
    raise exception 'A reversal must exactly invert the referenced transaction';
  end if;
  return v_id;
end;
$function$;

revoke all on function public.ledger_reject_mutation() from public, anon, authenticated;
revoke all on function public.ledger_check_transaction_balance() from public, anon, authenticated;
revoke all on function public.post_ledger_transaction(text, text, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.post_ledger_transaction(text, text, text, text, jsonb, uuid) to service_role;

create or replace view public.ledger_account_balances
with (security_invoker = true)
as
select a.id, a.account_code, a.name, a.asset_code, a.account_type, a.owner_user_id,
  coalesce(sum(case when e.side = 'debit' then e.amount else -e.amount end), 0) as net_debits,
  count(e.id) as entry_count
from public.ledger_accounts a
left join public.ledger_entries e on e.account_id = a.id
group by a.id;
revoke all on public.ledger_account_balances from public, anon, authenticated;
grant select on public.ledger_account_balances to service_role;
 then
      raise exception 'Invalid ledger entry';
    end if;
    v_asset := v_line ->> 'asset';
    v_side := v_line ->> 'side';
    v_amount := (v_line ->> 'amount')::numeric;
    if v_amount <= 0 then
      raise exception 'Ledger entry amount must be greater than zero';
    end if;
    select * into v_account from public.ledger_accounts
      where asset_code = v_asset and account_code = v_line ->> 'account_code' and is_active;
    if not found then raise exception 'Unknown or inactive ledger account'; end if;
    insert into public.ledger_entries(transaction_id, account_id, asset_code, side, amount)
      values (v_id, v_account.id, v_asset, v_side, v_amount);
  end loop;

  if p_reversal_of is not null and not exists (
    select 1 from public.ledger_transactions where id = p_reversal_of
  ) then
    raise exception 'Reversed transaction does not exist';
  end if;
  if p_reversal_of is not null and exists (
    (select a.account_code, e.asset_code, e.side,
        sum(e.amount)::numeric(24, 8) as amount
     from public.ledger_entries e join public.ledger_accounts a on a.id = e.account_id
     where e.transaction_id = v_id group by a.account_code, e.asset_code, e.side
     except
     select a.account_code, e.asset_code,
        case e.side when 'debit' then 'credit' else 'debit' end,
        sum(e.amount)::numeric(24, 8)
     from public.ledger_entries e join public.ledger_accounts a on a.id = e.account_id
     where e.transaction_id = p_reversal_of group by a.account_code, e.asset_code, e.side)
    union all
    (select a.account_code, e.asset_code,
        case e.side when 'debit' then 'credit' else 'debit' end,
        sum(e.amount)::numeric(24, 8)
     from public.ledger_entries e join public.ledger_accounts a on a.id = e.account_id
     where e.transaction_id = p_reversal_of group by a.account_code, e.asset_code, e.side
     except
     select a.account_code, e.asset_code, e.side,
        sum(e.amount)::numeric(24, 8)
     from public.ledger_entries e join public.ledger_accounts a on a.id = e.account_id
     where e.transaction_id = v_id group by a.account_code, e.asset_code, e.side)
  ) then
    raise exception 'A reversal must exactly invert the referenced transaction';
  end if;
  return v_id;
end;
$function$;

revoke all on function public.ledger_reject_mutation() from public, anon, authenticated;
revoke all on function public.ledger_check_transaction_balance() from public, anon, authenticated;
revoke all on function public.post_ledger_transaction(text, text, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.post_ledger_transaction(text, text, text, text, jsonb, uuid) to service_role;

create or replace view public.ledger_account_balances
with (security_invoker = true)
as
select a.id, a.account_code, a.name, a.asset_code, a.account_type, a.owner_user_id,
  coalesce(sum(case when e.side = 'debit' then e.amount else -e.amount end), 0) as net_debits,
  count(e.id) as entry_count
from public.ledger_accounts a
left join public.ledger_entries e on e.account_id = a.id
group by a.id;
revoke all on public.ledger_account_balances from public, anon, authenticated;
grant select on public.ledger_account_balances to service_role;
