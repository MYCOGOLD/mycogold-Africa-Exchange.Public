# MycoGold C++ market engine

This directory is the start of the native C++ compute core. C++ is intended for
deterministic, CPU-intensive domain calculations; Next.js/TypeScript remains the
web presentation, authentication and orchestration layer. PostgreSQL remains the
source of truth for orders, verified trades and financial records.

## Build and test

```sh
cmake -S engine/cpp -B build/engine
cmake --build build/engine --config Release
ctest --test-dir build/engine --output-on-failure
./build/engine/order_book_benchmark 50000
```

## Current modules

- MFPI VWAP from caller-supplied verified/settled trades only.
- 30% median-price outlier guard.
- Configurable minimum-volume and publication thresholds.
- Explicit UNPUBLISHED / INDICATIVE / VERIFIED_LIVE output states.
- Deterministic single-book price-time matching for buy and sell limit orders.
- Integer KES cents per kg and integer gram quantities; no floating-point price comparisons.
- Maker-price execution proposals, partial fills, expiry filtering and self-trade prevention.
- Globally unique priority-sequence validation and a repeatable synthetic benchmark target.

## Matching engine contract

The caller must provide only authenticated, authorized, active orders from one
commodity + grade + market book, with a globally unique, monotonically assigned priority sequence.
The engine returns proposed fills and self-trade-prevention instructions. It
does not persist order state, reserve inventory, create trades, post ledger
entries, authenticate users, or execute payments. The API/database layer must
revalidate order versions and availability and commit accepted fills atomically
in PostgreSQL using idempotency and row locking. A returned fill is not a
completed or settled trade.

Priority sequence values must be unique within each matching request; duplicate
sequences are rejected rather than silently imposing an arbitrary time order.

The current request model in the application represents buyer order requests,
not a complete exchange-grade bid/ask order book. Do not route existing order
requests through this engine until limit-price, open quantity, expiry, order
version, product grade, market, and authorization semantics are explicitly
modeled and tested.

## Market-index governance

The MFPI caller must query only eligible, settled trade records. The 30% guard
and publication thresholds are configurable policy inputs and require product
and data-governance approval before production publication. Asking prices and
unverified quotes must never be passed as confirmed trades.

## Language-share target

The 60% C++ objective should be measured against the **domain-engine source
files** (pricing, matching, analytics, forecasting and simulation), excluding
UI, framework glue, configuration, generated assets and SQL. It is not a
meaningful or safe target to force 60% of the entire repository into C++:
Next.js pages, browser UI, Supabase policies and deployment configuration belong
in their native technologies. C++ modules must earn their place through
benchmarks and parity tests before replacing existing TypeScript behaviour.
