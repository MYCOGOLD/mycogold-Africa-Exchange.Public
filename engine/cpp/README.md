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
```

## Current module

- MFPI VWAP from caller-supplied verified/settled trades only.
- 30% median-price outlier guard.
- Configurable minimum-volume and publication thresholds.
- Explicit UNPUBLISHED / INDICATIVE / VERIFIED_LIVE output states.

The caller must query only eligible, settled trade records. This library does
not connect to the database, authenticate users, mutate orders, post ledger
entries, or execute payments. The 30% guard and publication thresholds are
configurable policy inputs and require product/data governance approval before
production publication.

## Language-share target

The 60% C++ objective should be measured against the **domain-engine source
files** (pricing, matching, analytics, forecasting and simulation), excluding
UI, framework glue, configuration, generated assets and SQL. It is not a
meaningful or safe target to force 60% of the entire repository into C++:
Next.js pages, browser UI, Supabase policies and deployment configuration belong
in their native technologies. C++ modules must earn their place through
benchmarks and parity tests before replacing existing TypeScript behaviour.
