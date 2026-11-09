# MycoGold security operations

## Staff authorization

The profile-access endpoint verifies the Supabase access token with Supabase Auth and grants staff status only when one of these trusted server-side conditions is true:

- The authenticated user's UUID is in `STAFF_USER_IDS`; or
- The user's trusted `app_metadata.role` is `staff` or `admin`.

Do not use `user_metadata`, profile fields, phone numbers, or client-side flags to grant staff privileges.

### Configure staff UUIDs

1. In Supabase Dashboard, open Authentication -> Users.
2. Copy the UUID for each approved staff account.
3. In the server deployment environment (for example Vercel -> Project -> Settings -> Environment Variables), add `STAFF_USER_IDS`.
4. Set its value to comma-separated UUIDs, with no quotes, for example `uuid-one,uuid-two`.
5. Redeploy the application.
6. Test with one approved staff account and one ordinary account. The ordinary account must receive `isStaff: false`.

Never prefix this variable with `NEXT_PUBLIC_`. Do not put a Supabase service-role key in browser code or expose it in client-side environment variables.

## Database RLS audit — required before policy changes

The repository currently does not include a Supabase migration/schema definition for `profiles`, `listings`, `trades`, or `live_prices`. Do not guess column names or write broad policies.

Run [the read-only Supabase audit](../supabase/audit_security.sql) in Supabase Dashboard -> SQL Editor. Save/export the complete results for all six sections and use them to design migrations against the actual schema.

Required policy outcomes to verify:

- `profiles`: authenticated users can select/update only their own profile; profile IDs cannot be reassigned; role and balance are not user-editable.
- `listings`: public/guest read access must match the intended marketplace visibility; authenticated users can create listings only for themselves and update/delete only their own listings; staff moderation must be separately authorized.
- `trades`: only the buyer/seller participants can read their trade; users cannot create arbitrary completed trades or alter settlement status from the browser.
- `live_prices`: public read access may be appropriate; writes must be restricted to a trusted server/worker identity.

These are target behaviours, not policies already installed. RLS must be tested with anon, ordinary authenticated, staff, and service roles before production.

## Incident and release checklist

- Keep payment credentials and service-role keys only in server-side secret storage.
- Rotate any credential accidentally committed to Git history; deleting a file in a later commit does not revoke a leaked credential.
- Never treat a browser/localStorage confirmation as a settled trade or wallet balance.
- Do not accept live escrow funds until server-authoritative order state, idempotent payment callbacks, reconciliation, and audit logs are implemented.
- Require CI typecheck/build and security checks before release.
