# Atomic exchange match-application specification

Status: **implementation contract — not an applied migration or live database function**.

This document turns the exchange-order design into database acceptance rules.
It deliberately does not alter the existing `public.orders` buyer-request flow.

## Transaction boundary

A single PostgreSQL transaction is the only authority allowed to convert C++
proposed fills into exchange trades. The C++ engine is a deterministic
calculation component; it cannot reserve stock, update orders, create trades,
post a ledger entry, or settle money.

The transaction must be all-or-nothing for one match batch:

- Every proposed order must still be active, unexpired and at the exact source
  version supplied to the matcher.
- Every proposed quantity must be positive and no greater than the locked
  remaining quantity.
- The same order may appear in several fills in one batch. Aggregate all
  quantities per order before validating and applying the decrement.
- The sum of all decrements for an order must not exceed its locked remaining
  quantity.
- Any failed validation aborts the whole batch. The worker reloads a fresh
  snapshot and asks the matcher to recompute; it must not salvage a subset of
  stale fills.

## Lock acquisition order

Use a durable `exchange_books` row keyed by
`(commodity_code, grade_code, market_code)` as the per-book mutex.

Within one transaction:

1. Lock the book row with `SELECT ... FOR UPDATE`.
2. Lock every affected inventory/listing row in ascending primary-key order.
3. Lock every affected exchange-order row in ascending primary-key order.
4. Validate and aggregate the proposed fills.
5. Insert the idempotency/batch record, trade rows and order events.
6. Update order remaining quantities, versions and statuses.
7. Commit.

Every writer that can reserve or release inventory for an exchange-backed
listing must acquire the same inventory/listing lock before changing the
shared reservation total. Any legacy buyer-request workflow that can reserve
the same stock must participate in this lock protocol before that stock can be
made exchange eligible.

The book-row lock serializes match application within one book. Different
books can proceed independently. Stable row ordering reduces deadlocks; all
code paths must use the same ordering.

## Stale-snapshot and quantity validation

The transaction must compare, for each affected order:

- primary key and expected source version;
- active status (`OPEN` or `PARTIALLY_FILLED`);
- expiry strictly later than the transaction's captured server time;
- remaining quantity greater than zero;
- unchanged book identity and side;
- owner and listing/inventory eligibility;
- no suspension, verification failure or moderation hold.

Capture `transaction_timestamp()` once and use that value for every expiry
check in the batch. Do not compare each row against a moving application clock.

The fill's buyer and seller order versions are snapshot assertions, not new
versions. If an order appears in multiple fills, every fill must carry the same
snapshot version for that order. A conflicting version within one batch is a
malformed proposal and must be rejected.

Execution price must satisfy both limit constraints:
`buy_limit >= execution_price >= sell_limit`.
Quantity must be represented in integer grams and price in integer KES cents
per kilogram. No floating-point arithmetic is permitted in the transaction.

## Idempotency

The worker supplies a cryptographically random match-batch key generated before
the first attempt and reuses it on every retry of that logical batch.

Persist the key under a unique constraint. On conflict, return the already
committed batch result; never reapply quantity decrements or insert duplicate
trades. A transaction that fails before commit must leave no batch, trade,
event or quantity update behind.

Each order-creation request separately uses the unique
`(trader_id, idempotency_key)` constraint. Match-batch idempotency does not
replace order-creation idempotency.

## Shared inventory reservation invariant

An exchange SELL order may reserve only inventory that is available after all
legacy and exchange reservations have been accounted for.

Until a unified reservation coordinator is deployed and concurrency-tested,
the safe rollout is:

- exchange test orders use isolated test inventory;
- production listings remain on their existing buyer-request workflow;
- no live listing is simultaneously eligible for legacy requests and exchange
  SELL orders;
- inventory is reconciled before any listing changes workflow mode.

Do not infer availability from a stale listing quantity alone. The reservation
write must lock the authoritative inventory row and atomically prove that the
new reservation keeps total reservations within available stock.

## Atomicity requirements

A successful batch commits all of the following together:

- one match-batch idempotency record;
- one append-only trade fact per fill;
- one append-only order event per affected order transition;
- decremented remaining grams and incremented order versions;
- updated order status (`PARTIALLY_FILLED` or `FILLED`).

A failure in any insert, constraint, or update rolls back all of these changes.
Trade creation does not imply payment, payout, escrow release, or ledger
settlement. Those are separate workflows with their own idempotency keys and
authorization controls.

## Required database tests

Run these against a disposable Supabase project or isolated development branch:

1. Two concurrent workers attempt the same snapshot: at most one batch commits.
2. Two different batches compete for the final grams of one SELL order: total
   committed fills never exceed its remaining quantity.
3. An order version changes after snapshot: the whole proposed batch is rejected.
4. One order appears in multiple fills: aggregated decrement is exact and
   cannot go negative.
5. A malformed batch repeats an order with inconsistent source versions: reject.
6. An expired order at transaction start cannot fill.
7. A trade insert constraint failure rolls back order quantities, versions,
   events and the batch idempotency record.
8. A retried committed batch returns its original result and creates no
   additional trade or decrement.
9. Legacy and exchange reservations racing for the same listing cannot reserve
   more than the available inventory.
10. Browser roles cannot write exchange orders' server-owned fields, trades,
    events, reservation totals or settlement state.

## Release gate

Do not route production listings into this flow until all database tests pass,
RLS and grants are reviewed, database advisors are clean, the legacy inventory
reservation invariant is demonstrated under concurrency, and the migration has
a tested rollback plan. No migration is included in this document.
