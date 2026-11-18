-- Keep public reads for produce-listings, but route all object creation and
-- replacement through the server endpoint that authenticates, rate-limits,
-- validates, and re-encodes uploaded images.
drop policy if exists produce_listings_insert_own_folder on storage.objects;
drop policy if exists produce_listings_update_own_folder on storage.objects;

revoke insert, update on storage.objects from public, anon, authenticated;
grant insert, update on storage.objects to service_role;
