# MycoGold C++ matching gateway

A small Go HTTP boundary that invokes the deterministic C++20 matching engine
through its stable C ABI. It is a private compute service, not a public API and
not a settlement service.

## Build

From the repository root:

```sh
cmake -S engine/cpp -B build/engine -DCMAKE_BUILD_TYPE=Release
cmake --build build/engine --parallel
cd services/matcher-go
go test ./...
go build -o ../../build/mycogold-matcher .
```

The C++ shared library must remain discoverable at
`build/engine/libmycogold_market_engine.so` when the service starts.

## Run

```sh
export MYCOGOLD_MATCHER_HMAC_SECRET="$(openssl rand -hex 32)"
export PORT=8081
../../build/mycogold-matcher
```

## Signed request

The signature is HMAC-SHA256 over `<unix-seconds>\n<exact-request-body>`,
hex encoded and sent in `X-MycoGold-Signature`; the timestamp is sent in
`X-MycoGold-Timestamp`. Requests outside a 30-second clock window are rejected.
Use TLS or a private service mesh in deployment. Never expose this port directly
to the public internet.

`POST /v1/match` accepts one bounded JSON object with `nowEpochMs` and
`orders`. The matcher only proposes fills. The caller must revalidate all
source versions and inventory reservations inside a single PostgreSQL
transaction before persisting trades. No database writes, payments, escrow,
or ledger operations occur here.
