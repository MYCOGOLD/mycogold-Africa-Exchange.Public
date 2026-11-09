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
- `20261109061019_revoke_direct_auth_helper_execution.sql`
- `20261109061428_secure_listing_moderation_and_photo_storage.sql`
- `20261109061503_disable_client_side_trade_writes.sql`
- `20261109062352_protect_listing_identity_and_photo_paths.sql`
- `20261109062814_add_safe_order_request_workflow.sql`
- `20261109062838_serialize_order_quantity_reservations.sql`
- `20261109062855_secure_global_order_reservation_count.sql`
- `20261109062958_prevent_listing_quantity_oversell.sql`
- `20261109063025_consolidate_order_update_policy.sql`
- `20261109063801_require_server_validated_listing_image_uploads.sql`
- `20261109063835_revoke_direct_storage_insert_grants.sql`
- `20261109064140_disable_unverified_market_price_feed_access.sql`
- `20261109064518_revoke_public_storage_insert_privileges_cascade.sql`
- `20261109064612_add_explicit_deny_policies_for_legacy_tables.sql`
- `20261109065346_require_positive_listing_price_and_quantity.sql`
- `20261109065745_enforce_listing_owner_and_profile_lifecycle.sql`
- `20261109065931_require_complete_produce_listings.sql`
- `20261109065938_require_listing_photo.sql`
- `20261109070003_add_listing_upload_rate_limit.sql`
- `20261109070033_verify_listing_photo_object.sql`
- `20261109070314_store_listing_photo_paths_not_absolute_urls.sql`
- `20261109070435_deny_rate_limit_api_access_and_require_quantity.sql`

The migrations:

- Remove the broad `profiles.open` policy and restrict profile reads/inserts/updates to the authenticated owner.
- Restrict profile column writes to `id`, `phone`, and `name`; wallet `balance` is not writable by browser roles and now defaults to zero.
- Keep public reads for active listings. The legacy `live_prices` table is now private until a verified market-data source and provenance checks exist.
- Restrict listing creation to the authenticated seller and listing changes/deletion to the owner or trusted `app_metadata.role` staff/admin.
- Restrict trade reads to the owner or trusted staff/admin; browser users cannot create, update, or delete trade rows.
- Add an `orders` request workflow: authenticated buyers can request quantities from active listings; the database derives buyer, seller, unit price and total from trusted context; order terms are immutable; only the buyer can cancel a request and only the seller can accept/reject it. Pending/accepted quantities are reserved under a listing-row lock to prevent overselling.
- Put new listings into `pending` review state by default. Only the server-side staff moderation route can approve or deactivate them; listing owners cannot write the moderation status.
- Derive the public seller label from the authenticated seller's profile rather than trusting browser input; store only the seller-owned storage object path, and verify that the uploaded object actually exists before accepting a listing. This avoids hard-coding a Supabase project URL in the database.
- Add the public `produce-listings` image bucket (JPEG/PNG/WebP, bucket hard cap 5 MB; upload API limit 4 MB). The database stores an object path, not an absolute project URL. Uploads pass through `/api/listings/photo`, which verifies the authenticated user, checks file signatures and size, enforces a database-backed limit of 10 uploads per user per hour, and uses a server-only key; the browser INSERT policy is removed (a direct authenticated insert was tested and denied by Storage RLS). The server route uses the service-only storage key. Users can delete only their own uploaded objects.
- Remove anonymous/authenticated table-wide write privileges and disable API access to the legacy `test_users` table.
- Harden the `handle_new_user` SECURITY DEFINER helper, set an empty search path, align it with the live `profiles(id, phone, name)` columns, and revoke direct execution from API roles. (The `auth.users` AFTER INSERT trigger `on_auth_user_created` is attached to this function.)
- Add the `listings.status` field/check constraint and seller index.
- Enforce positive listing prices and quantities at the database boundary.
- Require a photo object to exist in the seller's own storage folder before a listing insert/update can commit.
- Require non-empty product/category/location and a seller-owned listing photo before a listing row can be inserted.
- Require every listing to have an owning Auth user; cascade deleted Auth accounts to their profiles and listings, while order foreign keys restrict deletion when order records still exist.

All six application tables (`profiles`, `listings`, `orders`, `trades`, `live_prices`, and `test_users`) retain RLS. The legacy `test_users` and `live_prices` tables have explicit deny policies for `anon` and `authenticated` and are not exposed to the browser API.

## Server-side staff moderation configuration

The staff listing moderation route (`/api/staff/listings`) verifies the user's Supabase access token and trusted staff identity before using a server-side privileged key to update listing status. Configure `SUPABASE_SERVICE_ROLE_KEY` (or the newer `SUPABASE_SECRET_KEY`) only in the server deployment environment. Never use a `NEXT_PUBLIC_` prefix or expose this key to browser code. Staff users who need database-level trade visibility must also have trusted `app_metadata.role` set to `staff` or `admin`.

## Remaining Supabase advisories

The post-migration security advisor reports one remaining warning: leaked-password protection is disabled. Enable Supabase Auth's leaked-password protection in the Auth password/security settings and test the signup/password-reset flows:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

The performance advisor currently marks indexes unused because there is almost no marketplace traffic. Keep the buyer/seller and foreign-key indexes and re-check after real usage.

## Public static demo and exchange settlement

The root GitHub Pages `index.html` is an interactive prototype that generates illustrative sample listings and prices in the browser. It is not connected to the Supabase exchange database, and its numbers must not be represented as live market quotes, verified listings, completed trades, or real earnings. The page has been labelled as demo-only and its fixed 1100px mobile layout has been removed. Use the authenticated application/API and database for persisted exchange data.

The synthetic price emitter and escrow prototype are disabled as described below.

## Exchange settlement and synthetic price feed

The legacy `live_prices` table contained a synthetic sample index and hub values. That row was removed, public reads were revoked, and the frontend no longer consumes the table. Do not republish a market index until its source, timestamp, units, and audit trail are verified.

The browser-only trade confirmation flow has been replaced by a non-payment order-request workflow. Browser roles cannot create/update/delete `trades` rows. Buyers can request a quantity; sellers can accept/reject; buyers can cancel. The database derives price and parties and prevents concurrent over-reservation. An accepted request is not a completed sale, payment, escrow, or settlement. MFPI is unpublished; the frontend no longer consumes the legacy `live_prices` table. The browser's localStorage is not treated as a trade ledger. The legacy `MYCOGOLD_ESCROW.PVT` script has been converted to a fail-closed safety stub: mock STK identifiers and unverified payout/release are disabled. The minute-based synthetic price emitter has also been disabled because it generated pseudo-random prices rather than verified market observations.

The `OrdersPanel` in user profiles shows each user's buyer/seller order requests. Listing photo uploads now require the server-side `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` and are rejected if file signatures do not match the declared image type. The new `/api/staff/listings` route performs staff verification server-side before using a privileged Supabase key. Configure `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` only as a server-side deployment secret. Do not expose it through `NEXT_PUBLIC_` variables.

## Database tests completed

The following database checks were executed in temporary transactions and rolled back; they created no persistent test orders or listings:

- An authenticated user could create their own profile; its ID matched the Auth user and wallet balance defaulted to zero.
- An authenticated seller could create a listing; the database supplied the seller display label and set its status to `pending`.
- An authenticated buyer's order request derived buyer ID, seller ID, unit price and total from the listing.
- The seller could accept a request; the buyer could not cancel it after acceptance.
- A buyer could not request their own listing.
- A second request that would exceed the listing's remaining quantity was rejected.
- Anonymous users saw an active listing but not a pending listing.
- An authenticated direct insert into the produce image bucket was denied by Storage RLS.
- The database-backed upload limiter allowed the first 10 requests in a test window and blocked the 11th; API roles cannot execute the limiter or read its counter table.
- A listing insert with a seller-owned but nonexistent storage object was rejected by the database photo-integrity trigger.
- Permission checks confirmed browser roles cannot change order price/total/status on insert, listing moderation status, profile balance, or trade rows.

The live project currently has two Auth users but zero persisted profiles, listings, orders and trades. The legacy synthetic price row was removed. These checks verify policy logic, not full UI behaviour under real user traffic.

## Verification still required

- Test anon, ordinary authenticated, owner, staff/admin, and service-role behavior against non-production test accounts.
- Confirm staff users have trusted `app_metadata.role` or are configured in the server-only `STAFF_USER_IDS` variable. The database staff policies use `app_metadata.role`.
- Verify the live frontend deployment uses the intended Supabase project and environment variables.
- Test order requests with separate buyer and seller accounts, including concurrent requests, over-quantity requests, self-purchases, seller acceptance/rejection, buyer cancellation, and attempts to change immutable price/party fields. The UI's order request is not a payment or completed sale.
- Do not treat a browser/localStorage confirmation as a settled trade or wallet balance.
- Do not accept live escrow funds until server-authoritative order state, authenticated and idempotent Daraja callbacks, real B2C payout verification, reconciliation, and audit logs are implemented.

## Incident and release checklist

- Keep payment credentials and service-role keys only in server-side secret storage.
- Rotate any credential accidentally committed to Git history; deleting a file in a later commit does not revoke a leaked credential.
- Require CI typecheck/build and security checks before release. The latest Application CI and CodeQL runs fail before any job step starts (`runner_id=0`, no steps, and no job logs). The application build and static analysis have therefore not run; resolve GitHub Actions runner availability/policy before treating CI as passed.
