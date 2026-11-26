# MycoGold Africa Exchange

A Kenya fresh-produce marketplace prototype built with Next.js, Supabase and a separate static GitHub Pages demo.

## Deployment surfaces

This repository currently contains two different frontends:

- **GitHub Pages:** the root `index.html` is a standalone visual demo. It uses illustrative sample data and is not connected to the Supabase order database. It must not be used to accept orders or payments.
- **Next.js application:** the App Router application under `app/` is the connected marketplace frontend. It requires a server deployment (Vercel is configured in `vercel.json`) to run its API routes and server-only secret keys.

Do not point the production customer domain at the static demo if you expect authenticated listings and order requests.

## Local development

Requirements: Node.js 22 and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Set the Supabase values in `.env.local` before using authentication or database features.

## Environment variables

Browser-safe:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server-only:
- `SUPABASE_SERVICE_ROLE_KEY` **or** `SUPABASE_SECRET_KEY`
- `STAFF_USER_IDS` — comma-separated trusted Supabase Auth user UUIDs

Never expose a service/secret key through a `NEXT_PUBLIC_` variable or commit it to Git.

Daraja variables in `.env.example` are placeholders only. The payment/escrow integration is intentionally disabled; no real payment or payout is implemented.

## Database changes

The live Supabase project has RLS hardening and the safe order-request workflow applied. The matching SQL files are under `supabase/migrations/`.

New accounts require a real email address. The phone number is stored as contact information but is not SMS-OTP verified; staff must manually contact a seller before activating their listing. Legacy phone-only accounts use the old synthetic email alias and may require support-assisted migration.

Order requests are not payments or completed sales:
- Buyers request a quantity from an active listing.
- The database derives the buyer, seller, unit price and total.
- The seller may accept or reject; the buyer may cancel.
- Requests are non-binding interest signals only. The app does not yet exchange contact details or provide messaging.
- Open/accepted requests reserve listing quantity.
- No wallet is debited and no escrow or payout is performed.

Apply and verify schema changes against a development project before promoting them to production. Run the read-only audit in `supabase/audit_security.sql` and review Supabase security/performance advisors after migrations.

## CI and release

GitHub Actions workflows:
- `Application CI`: `npm ci`, TypeScript typecheck and Next.js production build.
- `CodeQL`: JavaScript/TypeScript security analysis.

Do not release until those checks execute successfully. A GitHub Actions job that fails before receiving a runner has not run the application checks.

## Production gates still open

- Connect the Vercel project and configure server-only Supabase secrets.
- Enable Supabase leaked-password protection (requires an eligible plan).
- Test signup, profile creation, listing upload, order requests and seller responses with separate test accounts.
- Add payment processing only after verified Daraja callback handling, idempotency, B2C result verification and reconciliation are implemented.
- Perform end-to-end, abuse, accessibility, backup/restore and load tests before accepting real customers or funds.


## Local-first engineering

Cloud GitHub Actions are intentionally limited to manual `workflow_dispatch` runs
and version tags (`v*`) while hosted runner usage is constrained. Ordinary pull
requests and branch pushes do not start hosted jobs.

Run the local verification pipeline before pushing:

```bash
npm ci
npm run ci:local
```

The local runner executes native C++ build/tests, TypeScript checks, unit tests,
production safety contracts and the Next.js production build. The production
dependency audit runs by default and requires registry access. For a fully
offline run, use `npm run ci:local:offline`; this explicitly
skips the network-dependent audit and does not report it as passed.

Enable the local pre-commit hook once per clone:

```bash
npm run hooks:install
```

Optional Docker verification: `CI_LOCAL_DOCKER=1 npm run ci:local`.
To install dependencies during the run, use `CI_LOCAL_INSTALL=1 npm run ci:local`.
Cloud workflows remain manually runnable in GitHub Actions or can be triggered
by pushing a version tag after local verification. Hosted runs still depend on
the repository's available Actions allowance.

## Native exchange compute service (experimental)

The native engine under `engine/cpp/` provides deterministic order matching,
market-index and freshness calculations, bounded policy evaluation, SHA-256
fingerprints, a versioned internal message codec and a classical QUBO solver.
It is built as a C++20 shared library and exposes a side-effect-free C ABI.

A Go 1.23+ gateway under `services/matcher-go/` invokes the C ABI using cgo.
It accepts signed internal requests only, enforces request-size/order-count
limits, and returns proposed fills with source row versions. It has no database,
inventory, payment, escrow or ledger write access.

Build and test from the repository root:

```bash
npm run matcher:test
npm run matcher:build
```

Run locally with a private HMAC secret:

```bash
export MYCOGOLD_MATCHER_HMAC_SECRET="$(openssl rand -hex 32)"
npm run matcher:run
```

Build the isolated service container:

```bash
docker build -f services/matcher-go/Dockerfile -t mycogold-matcher:local .
```

**Integration boundary:** the Next.js order workflow does not yet call this
service. Before any live routing, implement a private authenticated caller and
a PostgreSQL transaction that locks the exchange book, revalidates order
versions/status/expiry and shared inventory reservations, then commits every
fill atomically. A matcher response alone is never a trade or settlement.
