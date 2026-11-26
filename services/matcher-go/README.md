# MycoGold C++ matching gateway

Requirements: Go 1.23+, CMake 3.20+, a C++20 compiler, OpenSSL development headers, and (for the container build) Docker.

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
`build/engine/libmycogold_market_engine.so` when the service starts. The cgo
bridge marshals bounded strings into one native arena rather than allocating
five C strings per order.

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

## Container image

From the repository root:

```sh
docker build -f services/matcher-go/Dockerfile -t mycogold-matcher:local .
docker run --rm -p 8081:8081 \
  -e MYCOGOLD_MATCHER_HMAC_SECRET="$(openssl rand -hex 32)" \
  mycogold-matcher:local
``

The image builds the C++ shared library, runs CTest and Go tests in the builder,
then copies only the gateway binary, native shared library and runtime OpenSSL
library into a non-root runtime image. Keep the service behind a private
network/TLS gateway; it has no public user authentication or database access.

## Native bridge benchmark

After building the shared library, run the cgo-to-C++ microbenchmark:

```sh
go test ./engine -run '^$' -bench BenchmarkMatchOneThousandOrders -benchmem
```

This measures Go-to-C ABI marshaling plus the native matcher for a fixed
1,000-order book. It does not include HTTP, HMAC, JSON decoding or PostgreSQL
transaction latency. Compare runs on the same host and compiler; do not use
microbenchmark throughput as a production capacity claim.
