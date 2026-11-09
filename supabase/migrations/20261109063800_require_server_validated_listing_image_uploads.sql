-- All produce-listing uploads must pass through the authenticated server route,
-- which checks file signatures and size before using the server-only storage key.
drop policy if exists produce_listing_upload_own_folder on storage.objects;
grant insert, select on storage.objects to service_role;
