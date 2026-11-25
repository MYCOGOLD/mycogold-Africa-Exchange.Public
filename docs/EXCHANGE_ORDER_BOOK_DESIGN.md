# Exchange order-book data model and rollout contract

Status: **design only — not an applied migration**.

This design is based on the current MycoGold schema, where `public.listings`
stores seller offers and `public.orders` stores buyer requests with
`requested / accepted / rejected / cancelled` states. The existing tables must
remain compatible while the exchange book is introduced.

## Service ownership

| Concern | Owner |
|---|---|
| User identity and request validation | Next.js API gateway (TypeScript) |
| Price-time match proposal | C++ market engine |
| Order IDs, priority sequence, row versions | PostgreSQL |
| Inventory reservation, trade creation and event append | PostgreSQL transaction |
| Market forecasts and freshness estimates | Python TUSK services |
| Market feed delivery | Gateway + Supabase Realtime / Redis |

The C++ engine is never the source of truth. It returns proposed fills with the
input order versions. PostgreSQL rechecks those versions and quantities before
committing anything.

## Canonical units

- Price: integer **KES cents per kilogram**.
- Quantity: integer **grams**.
- Time: UTC Unix epoch milliseconds in the C++ contract; `timestamptz` in
  PostgreSQL.
- The gateway must not accept user ID, order ID, priority sequence, remaining
  quantity, execution price, order status, or settlement totals from clients.
- The database assigns IDs and priority sequence and increments row versions.

Do not silently round a legacy numeric listing price or quantity. Conversion
must reject values that cannot be represented exactly in the canonical units,
or use an explicitly approved rounding policy.

## Proposed tables

### `exchange_orders`

One row represents one limit order in one commodity / grade / market book.

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid | Server-generated order identity |
| `trader_id` | uuid | Authenticated owner |
| `listing_id` | uuid nullable | Required for SELL offers backed by a listing |
| `side` | text | BUY or SELL |
| `commodity_code` | text | Canonical commodity |
| `grade_code` | text | Quality grade |
| `market_code` | text | Regional hub / market |
| `limit_price_kes_cents_per_kg` | bigint | Positive integer limit price |
| `quantity_grams` | bigint | Original order quantity |
| `remaining_grams` | bigint | Unfilled quantity |
| `priority_sequence` | bigint identity | Server-assigned FIFO sequence |
| `version` | bigint | Optimistic concurrency version |
| `status` | text | OPEN, PARTIALLY_FILLED, FILLED, CANCELLED, EXPIRED |
| `expires_at` | timestamptz | Order expiry |
| `idempotency_key` | text | Client retry key, unique per trader |
| `created_at / updated_at` | timestamptz | Audit timestamps |

Required constraints and indexes:

- `quantity_grams > 0`, `remaining_grams >= 0`, and
  `remaining_grams <= quantity_grams`.
- `limit_price_kes_cents_per_kg > 0`, `version > 0`.
- BUY orders have no listing; SELL orders must reference an approved listing.
- Unique `(trader_id, idempotency_key)`.
- Unique priority sequence.
- Partial active-book index on
  `(commodity_code, grade_code, market_code, side, limit_price_kes_cents_per_kg, priority_sequence)`
  for OPEN / PARTIALLY_FILLED orders.
- Partial unique active SELL order per listing, until inventory supports multiple
  independently reserved sell lots.

### `exchange_trades`

Append-only trade facts created only inside the database match-application
transaction. Store both order IDs, buyer and seller IDs, commodity / grade /
market, execution price in KES cents per kg, quantity in grams, both source
order versions, a unique match idempotency key, and a separate settlement state.

A matched trade is **not** a settled trade. Payment and ledger posting remain
separate, explicitly authorized workflows.

### `exchange_order_events`

Append-only audit trail for order creation, partial/full fills, cancellation,
expiry and self-trade prevention. Events must include the order version and
server timestamp. Do not allow browser roles to insert or update these rows.

## Safe match-application transaction

1. Gateway authenticates the user and parses the strict
   `CreateLimitOrderRequest` contract.
2. PostgreSQL creates the order, assigns its priority sequence, stores the
   idempotency key and returns the canonical order.
3. A matching worker reads a bounded snapshot for one commodity / grade / market
   book, including each order's ID, remaining grams, version and sequence.
4. C++ calculates proposed fills and echoes the buy and sell row versions.
5. A database transaction locks the book and affected order rows in a stable
   order, then checks that every order still has the expected version, status,
   remaining quantity and expiry.
6. If any input is stale, reject the entire match batch and rebuild the snapshot.
   Do not partially apply a stale proposal.
7. If all checks pass, insert trades, decrement remaining quantities, increment
   order versions, update statuses and append order events in the same database
   transaction.
8. A unique match-batch idempotency key makes retries safe. The transaction
   commits once; a repeated request returns the original result.

Use a per-book lock to serialize match application for the same book. Different
commodity / grade / market books can progress independently. Lock individual
orders in a stable ID order to reduce deadlock risk.

## Critical inventory compatibility gate

The current marketplace already reserves quantities for legacy buyer requests.
A new exchange sell order must **not** reserve the same produce a second time.

Before activating exchange matching for any existing listing, implement one
shared inventory-reservation invariant across both workflows, or explicitly
move that listing into exchange-only mode and make the legacy order-request
trigger reject new requests for it. Existing reservations must be reconciled
before the mode switch. Until that is tested under concurrent requests, the
exchange must use isolated test inventory and must not match live listings.

## Security and rollout

- Keep exchange tables in a private schema if they do not need direct Data API
  access. If any table is exposed in `public`, enable RLS and grant only the
  minimum required privileges.
- Prefer SECURITY INVOKER. If a narrowly scoped SECURITY DEFINER function is
  unavoidable, put it in a non-exposed schema, use a fixed search path, check
  the authenticated actor explicitly, revoke default EXECUTE grants and test
  every role.
- Never trust `user_metadata` for authorization.
- No browser client may write match results, priority sequence, remaining
  quantity, trade facts, or settlement state.
- Do not apply this design directly to the production database. First create a
  Supabase development branch or disposable project, generate the migration
  with the Supabase CLI, apply it there, run RLS / concurrency / rollback tests,
  and inspect database advisors.
- Do not route the current `public.orders` buyer-request flow through C++ until
  the shared-inventory compatibility gate is satisfied.

## Acceptance tests before live routing

- Duplicate idempotency keys return the original order, not a second order.
- Concurrent sell reservations cannot exceed available listing inventory.
- Concurrent match workers cannot fill the same remaining quantity twice.
- A stale order version rejects the entire proposed batch.
- Every trade's quantity equals the decremented amount on both orders.
- Sum of fills never exceeds either order's remaining quantity.
- A failed trade insert rolls back all order quantity / status / event changes.
- Replayed match batches do not create duplicate trades or ledger entries.
- BUY and SELL orders cannot self-match.
- Expired, suspended, unverified or unauthorized orders never enter a book.
