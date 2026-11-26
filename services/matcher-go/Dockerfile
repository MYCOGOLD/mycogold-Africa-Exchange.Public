FROM golang:1.23-bookworm AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake g++ libssl-dev make && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY . .
RUN cmake -S engine/cpp -B build/engine -DCMAKE_BUILD_TYPE=Release -DMYCOGOLD_ENABLE_IPO=ON \
    && cmake --build build/engine --parallel \
    && ctest --test-dir build/engine --output-on-failure
WORKDIR /src/services/matcher-go
RUN go test ./... \
    && go build -trimpath -ldflags="-s -w" -o /src/build/mycogold-matcher .

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends libssl3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY --from=build /src/build/mycogold-matcher /src/build/mycogold-matcher
COPY --from=build /src/build/engine/libmycogold_market_engine.so /src/build/engine/libmycogold_market_engine.so
ENV PORT=8081
EXPOSE 8081
USER 65532:65532
ENTRYPOINT ["/src/build/mycogold-matcher"]
