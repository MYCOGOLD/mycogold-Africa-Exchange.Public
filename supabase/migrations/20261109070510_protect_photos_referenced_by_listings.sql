create or replace function public.prevent_delete_referenced_listing_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.bucket_id = 'produce-listings'
     and exists (
       select 1
       from public.listings l
       where l.photo_path = old.name
     ) then
    raise exception 'This photo is attached to a listing. Remove or replace the listing photo first.';
  end if;
  return old;
end;
$function$;

revoke all on function public.prevent_delete_referenced_listing_photo() from public, anon, authenticated, service_role;

drop trigger if exists produce_listing_prevent_delete_if_referenced on storage.objects;
create trigger produce_listing_prevent_delete_if_referenced
before delete on storage.objects
for each row execute function public.prevent_delete_referenced_listing_photo();
