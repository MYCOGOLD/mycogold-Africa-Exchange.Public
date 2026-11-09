-- Storage uploads are exclusively server-side; no browser API role may insert objects.
revoke insert on storage.objects from anon, authenticated;
