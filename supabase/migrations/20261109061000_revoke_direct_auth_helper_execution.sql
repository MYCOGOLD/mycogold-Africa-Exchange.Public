-- This function is intended only as a database trigger helper; no API role should call it directly.
revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
