# MycoGold production hardening and ledger plan

Discovery started 17 November 2026 against main at e3d43a6d32c4bced00dc7e1421d2125f1dff257f and Supabase project vuwqmuficrrcseoovsnn.

## Current verified state

- Supabase is active on the Free plan. At discovery, live history contained 33 migrations and the repository contained 38; the five repository-only migrations at that time are listed below.
- The live mcg_tokenomics view already has security_invoker=on. This historical issue is resolved in production, but the unreleased token-supply migration must preserve that option.
- The live produce-listings bucket is public for reads. Authenticated INSERT and UPDATE grants and matching folder policies are still present, despite earlier migrations intended to remove them.
- The three flagged SECURITY DEFINER functions still have no pinned search path. Their current EXECUTE grantees are the database owner and service_role.
- Anonymous users have table-wide SELECT on public.listings. The listing RLS policy limits rows, not columns. Staff listing policies still query public.admins, whose RLS has no policies.
- The current repository originally contained STK initiation, callback and escrow release code. Those routes now fail closed and the M-Pesa/escrow migration is held outside the deployable migration directory. The database migration required by the old routes is not deployed.
- The listing-photo API uses the listing-photos bucket, which is created only by the unreleased GPS/camera migration. Production currently has the older produce-listings bucket, so listing uploads are not aligned until that additive migration is reviewed and deployed.
- The latest production deployments for both linked Vercel projects are in ERROR. The failure log for the project linked to current main identifies a missing `mfpiFromListings` export; this reference is fixed locally. The duplicate mycogold-africa-exchange-public project lacks the app configuration needed by this code. Secret values were not inspected.
- GitHub Application CI, CodeQL and MYCOGOLD CI have failed before executing steps. Existing workflow files use GitHub-hosted ubuntu-latest; the failure is runner allocation, not a reported source-code failure. Branch protection does not currently require passing checks.
- The security advisor currently reports mutable search paths, the disabled leaked-password check, and the admins table without policies. The view warning is no longer present. Health advisor is clean.
- Supabase restore capability, SMTP settings, redirect allow-list, phone verification and authenticated staff identities remain unverified. No production backup or restore drill was found. Production migrations remain gated on a verified backup/restore path.

## Migration drift

The five repository-only migrations are:

1. 20261112000000_add_mushroom_product_catalog
2. 20261112001000_expand_product_catalog_categories
3. 20261113000000_add_listing_gps_and_camera_storage
4. 20261113120000_add_mpesa_stk_and_escrow
5. 20261113130000_update_mcg_tokenomics_supply

The M-Pesa/escrow migration has been moved out of the deployable migrations directory to supabase/held-migrations/20261113120000_add_mpesa_stk_and_escrow.sql. It adds payment and escrow states, but release_order_escrow changes only order status and does not execute or reconcile a seller payout. Do not apply it or configure Daraja credentials until callback verification, idempotency, payout execution, reconciliation, ledger posting and operational controls are complete.

The catalog, GPS and tokenomics changes need local validation and dependency review before reconciliation. The M-Pesa/escrow migration is explicitly held: it adds payment and escrow states, but release_order_escrow changes only order status and does not execute or reconcile a seller payout. Do not apply it or configure Daraja credentials until callback verification, idempotency, payout execution, reconciliation, ledger posting and operational controls are complete.

## Phased execution

### Phase 1 — Read-only discovery — complete

Compared the live project, migration history, repository commit, current policies and grants, security/performance/health advisors, payment SQL/routes, CI workflows and linked Vercel deployments.

### Phase 2 — Access hardening — prepared locally; not deployed

- Remove authenticated browser Storage INSERT/UPDATE policies and grants while retaining public reads and service-side validated uploads.
- Expose only approved active-listing fields to anonymous callers.
- Keep the tokenomics view invoker-safe and publish its aggregate through a pinned, parameterless function.
- Pin the three flagged SECURITY DEFINER functions and retain service-role-only execution.
- Align database staff RLS with trusted Auth app_metadata.role; server routes may additionally use the server-only UUID allowlist.
- Verify anonymous, authenticated, owner, staff and service-role behavior before production rollout.
- Reconcile the listing-photo bucket and server route by reviewing the additive GPS/camera migration.

### Phase 3 — Ledger core — schema drafted locally; not deployed or integrated

The additive draft in `supabase/migrations/20261117070000_create_double_entry_ledger.sql` separates KES and MCG accounts, transactions and entries; has a service-role posting function with request-hash idempotency; prevents journal edits/deletes; checks deferred per-asset balancing; requires reversals to invert the source transaction; and includes an account-balance report view. It is not yet validated against a disposable database or connected to orders/trades. Do not backfill wallet balances or connect marketplace orders/trades until business rules and transaction provenance are reviewed. Keep all payment and payout paths disabled.

### Phase 4 — Migration reconciliation — pending verification

Test each non-payment repository-only migration independently, reconcile repository and live history through reviewed migrations, and document exact deployed versions. Keep the payment/escrow migration held until all payment and ledger gates pass.

### Phase 5 — CI, Vercel and release controls — in progress

Local safety checks, typecheck, tests, and the Webpack production build pass. Default Turbopack build still fails to start its CSS worker locally. The current production Vercel deployment remains failed on its previously captured missing-export error; it has not been redeployed. Restore GitHub runner allocation before requiring its status checks. Resolve the duplicate Vercel project/source configuration, verify required production variable names without revealing values, and deploy only from a successful CI/deployment build.

### Phase 6 — Account and disaster recovery blockers — blocked on account access

Upgrade the Supabase plan if needed, enable leaked-password protection, configure production SMTP and redirect URLs, decide whether SMS OTP is required, set trusted staff identities, and perform a database plus Storage-object backup/restore drill.

## Release guardrails

- Keep STK collection, payment callback processing, escrow release and B2C payout execution disabled.
- Do not infer a successful backup, restore, payment, callback, staff authorization or production deployment without fresh evidence.
- Do not apply the M-Pesa/escrow migration or any destructive schema/data change without a verified recovery point and the required explicit approval.
