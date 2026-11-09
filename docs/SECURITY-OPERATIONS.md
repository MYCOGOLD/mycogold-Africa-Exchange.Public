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
4. Set its value to comma-separated UUIDs, with no quotes.
5. Redeploy the application.
6. Test with one approved staff account and one ordinary account. The ordinary account must receive `isStaff: false`.

Never prefix this variable with `NEXT_PUBLIC_`. Do not put a Supabase service-role key in browser code or expose it in client-side environment variables.

## Database security — deployed migrations

The live Supabase project `mycogoldafrica` was inspected on 2026-11-09. The following migrations were applied successfully and are committed in this repository:

- `20261109060835_harden_marketplace_rls_and_privileges.sql`
- `20261109060907_refine_market_access_policies.sql`
- `20261109060921_optimize_rls_jwt_policy_checks.sql`

The migrations:

- Remove the broad `profiles.open` policy and restrict profile reads/inserts/updates to the authenticated owner.
- Restrict profile column writes to `id`, `phone`, and `name`; wallet `balance` is not writable by browser roles and now defaults to zero.
- Keep public reads for active listings and live market prices.
- Restrict listing creation to the authenticated seller and listing changes/deletion to the owner or trusted `app_metadata.role` staff/admin.
- Restrict trade reads to the owner or trusted staff/admin; browser users cannot update/delete trade rows.
- Remove anonymous/authenticated table-wide write privileges and disable API access to the legacy `test_users` table.
- Restrict the `handle_new_user` SECURITY DEFINER helper, set an empty search path, and align it with the live `profiles(id, phone, name)` columns.
- Add the `listings.status` field/check constraint and seller index.

All five public tables retain RLS. The `test_users` table intentionally has no API policies or anon/authenticated grants because it is a legacy test table. Do not re-enable access without a specific use case and tests.

## Remaining Supabase advisories

The post-migration security advisor reports one remaining warning: leaked-password protection is disabled. Enable Supabase Auth's leaked-password protection in the Auth password/security settings and test the signup/password-reset flows:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

The advisor also reports an informational RLS-without-policy notice for `test_users`; this is intentional because public API access has been revoked. A performance advisor reports the new seller index as unused immediately after creation; re-check after marketplace traffic.

## Verification still required

- Test anon, ordinary authenticated, owner, staff/admin, and service-role behavior against non-production test accounts.
- Confirm staff users have trusted `app_metadata.role` or are configured in the server-only `STAFF_USER_IDS` variable. The database staff policies use `app_metadata.role`.
- Verify the live frontend deployment uses the intended Supabase project and environment variables.
- Check all app pages and flows that create listings/trades; the database intentionally no longer permits browser-side profile balance changes or arbitrary trade updates.
- Do not treat a browser/localStorage confirmation as a settled trade or wallet balance.
- Do not accept live escrow funds until server-authoritative order state, idempotent payment callbacks, reconciliation, and audit logs are implemented.

## Incident and release checklist

- Keep payment credentials and service-role keys only in server-side secret storage.
- Rotate any credential accidentally committed to Git history; deleting a file in a later commit does not revoke a leaked credential.
- Require CI typecheck/build and security checks before release.
