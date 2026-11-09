-- Attempt to remove direct browser upload grants. Supabase may retain inherited
-- table privileges for API roles; RLS remains the actual enforcement boundary.
-- The produce-listings INSERT policy is dropped, so browser inserts are denied.
revoke insert on storage.objects from public, anon, authenticated cascade;
grant insert, select on storage.objects to service_role;
