create table if not exists public.listing_moderation_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  previous_status text,
  new_status text not null check (new_status in ('active','inactive')),
  seller_contact_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.listing_moderation_events enable row level security;
revoke all privileges on public.listing_moderation_events from anon, authenticated, service_role;

create policy listing_moderation_events_deny_api
  on public.listing_moderation_events for all to anon, authenticated
  using (false)
  with check (false);

create index if not exists listing_moderation_events_listing_created_idx
  on public.listing_moderation_events (listing_id, created_at desc);

create or replace function public.moderate_listing(
  p_listing_id uuid,
  p_status text,
  p_actor_id uuid,
  p_seller_contact_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  listing_row record;
  seller_phone text;
  reviewed_at timestamptz := clock_timestamp();
begin
  if p_actor_id is null or not exists (
    select 1 from auth.users u where u.id = p_actor_id
  ) then
    raise exception 'A valid staff actor is required.';
  end if;

  if p_status not in ('active','inactive') then
    raise exception 'Invalid moderation status.';
  end if;

  select l.id,l.seller_id,l.status
    into listing_row
  from public.listings l
  where l.id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing not found.';
  end if;

  if p_status = 'active' then
    if p_seller_contact_confirmed is not true then
      raise exception 'Seller contact must be manually confirmed before approval.';
    end if;

    select p.phone into seller_phone
    from public.profiles p
    where p.id = listing_row.seller_id;

    if seller_phone is null or length(trim(seller_phone)) = 0 then
      raise exception 'Seller has no contact phone on file.';
    end if;
  end if;

  update public.listings
  set status = p_status,
      updated_at = reviewed_at,
      moderated_at = reviewed_at,
      seller_verified_at = case when p_status = 'active' then reviewed_at else null end
  where id = p_listing_id;

  insert into public.listing_moderation_events (
    listing_id,actor_id,previous_status,new_status,seller_contact_confirmed,created_at
  )
  values (
    p_listing_id,p_actor_id,listing_row.status,p_status,
    coalesce(p_seller_contact_confirmed,false),reviewed_at
  );

  return jsonb_build_object(
    'id',p_listing_id,
    'status',p_status,
    'moderated_at',reviewed_at,
    'seller_verified_at',case when p_status = 'active' then reviewed_at else null end
  );
end;
$function$;

revoke all on function public.moderate_listing(uuid,text,uuid,boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.moderate_listing(uuid,text,uuid,boolean)
  to service_role;
