-- MycoGold Supabase security audit (READ ONLY)
-- Run in Supabase Dashboard -> SQL Editor using an account with catalog visibility.
-- This script does not change tables, data, grants, or RLS policies.

-- 1. Confirm whether the application tables exist and whether RLS is enabled/forced.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  case c.relkind when 'r' then 'table' when 'p' then 'partitioned table' else c.relkind::text end as relation_type
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'listings', 'trades', 'orders', 'live_prices', 'test_users')
order by c.relname;

-- 2. List every policy on those tables, including command, roles, USING and WITH CHECK.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'listings', 'trades', 'orders', 'live_prices', 'test_users')
order by tablename, policyname;

-- 3. Inspect actual columns and nullability before writing policies or migrations.
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'listings', 'trades', 'orders', 'live_prices', 'test_users')
order by table_name, ordinal_position;

-- 4. Inspect primary keys, foreign keys, unique constraints and check constraints.
select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column,
  cc.check_clause
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_schema = kcu.constraint_schema
 and tc.constraint_name = kcu.constraint_name
 and tc.table_name = kcu.table_name
left join information_schema.constraint_column_usage ccu
  on tc.constraint_schema = ccu.constraint_schema
 and tc.constraint_name = ccu.constraint_name
left join information_schema.check_constraints cc
  on tc.constraint_schema = cc.constraint_schema
 and tc.constraint_name = cc.constraint_name
where tc.constraint_schema = 'public'
  and tc.table_name in ('profiles', 'listings', 'trades', 'orders', 'live_prices', 'test_users')
order by tc.table_name, tc.constraint_type, tc.constraint_name;

-- 5. Review effective table grants for API roles.
select
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('profiles', 'listings', 'trades', 'orders', 'live_prices', 'test_users')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

-- 6. Identify SECURITY DEFINER functions that may bypass caller permissions.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  p.proconfig as function_settings
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
order by p.proname;
