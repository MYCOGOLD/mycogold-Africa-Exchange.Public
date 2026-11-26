# MycoGold C++ market engine

This directory is the start of the native C++ compute core. C++ is intended for
deterministic, CPU-intensive domain calculations; Next.js/TypeScript remains the
web presentation, authentication and orchestration layer. PostgreSQL remains the
source of truth for orders, verified trades and financial records.

## Build and test

```sh
cmake -S engine/cpp -B build/engine -DCMAKE_BUILD_TYPE=Release -DMYCOGOLD_ENABLE_IPO=ON
cmake --build build/engine --config Release --parallel
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
- Globally unique priority-sequence validation, stale-snapshot row-version echoes, and a randomized seven-run benchmark reporting median latency and throughput.
- C++20 Release builds use portable compiler optimization and optional link-time optimization (LTO) when supported; no host-specific CPU instruction set is forced.
- Time-and-temperature freshness decay using a configurable Q10 model and continuous temperature-history validation.

## Matching engine contract

The caller must provide only authenticated, authorized, active orders from one
commodity + grade + market book, with a globally unique, monotonically assigned priority sequence.
The engine returns proposed fills and self-trade-prevention instructions. It
does not persist order state, reserve inventory, create trades, post ledger
entries, authenticate users, or execute payments. The API/database layer must
revalidate both echoed order versions and availability and commit accepted fills atomically
in PostgreSQL using idempotency and row locking. A returned fill is not a
completed or settled trade.

Priority sequence values must be unique within each matching request; duplicate
sequences are rejected rather than silently imposing an arbitrary time order.

The current request model in the application represents buyer order requests,
not a complete exchange-grade bid/ask order book. Do not route existing order
requests through this engine until limit-price, open quantity, expiry, order
version, product grade, market, and authorization semantics are explicitly
modeled and tested.

## Freshness-model governance

The freshness model integrates a temperature-dependent decay hazard over
continuous temperature intervals. The Q10 profile is an explicit mathematical
assumption, not a universal biological constant. Each commodity / variety /
packaging profile must be calibrated against observed quality and shelf-life
measurements before it can drive a listing grade, price, delivery decision or
automatic rejection. The caller supplies the harvest timestamp explicitly; the engine verifies that
the first temperature interval begins exactly at harvest and covers continuously
through the calculation time. Missing temperature intervals are
rejected rather than silently treated as safe storage.

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

## Performance measurement

The benchmark generates a deterministic shuffled book with varied crossing
prices, performs one warm-up, then measures seven independent matching runs.
It reports median nanoseconds, orders/second and fills/second. Use the same
machine, compiler, build type and pair count when comparing revisions. The
benchmark is a microbenchmark, not a production capacity guarantee: it excludes
network, JSON decoding, authentication, database snapshot loading, transaction
locking and PostgreSQL commit latency.

Suggested local comparison sizes:

```sh
./build/engine/order_book_benchmark 10000
./build/engine/order_book_benchmark 50000
./build/engine/order_book_benchmark 100000
```

Do not enable -march=native for portable release artifacts. Benchmark on the
actual target hardware before choosing CPU-specific compiler flags.

## Runtime integration status

The native library currently builds and tests as an isolated compute component.
The Next.js application does not yet invoke it in its live order path. Do not
describe the exchange as C++-accelerated end to end until a versioned internal
service or native binding has been implemented, benchmarked, authenticated,
and connected to a PostgreSQL transaction that revalidates every proposed fill.
