#pragma once

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct mycogold_order_input {
  const char* order_id;
  const char* trader_id;
  const char* commodity_code;
  const char* grade_code;
  const char* market_code;
  int32_t side; /* 0 = BUY, 1 = SELL */
  int64_t limit_price_kes_cents_per_kg;
  int64_t quantity_grams;
  uint64_t priority_sequence;
  int64_t expires_at_epoch_ms;
  uint64_t version;
} mycogold_order_input;

typedef struct mycogold_fill_output {
  size_t buy_order_index;
  size_t sell_order_index;
  int64_t execution_price_kes_cents_per_kg;
  int64_t quantity_grams;
  uint64_t maker_priority_sequence;
  uint64_t buy_order_version;
  uint64_t sell_order_version;
} mycogold_fill_output;

typedef struct mycogold_prevented_output {
  size_t order_index;
} mycogold_prevented_output;

enum mycogold_engine_status {
  MYCOGOLD_ENGINE_OK = 0,
  MYCOGOLD_ENGINE_INVALID_ARGUMENT = 1,
  MYCOGOLD_ENGINE_BUFFER_TOO_SMALL = 2,
  MYCOGOLD_ENGINE_INTERNAL_ERROR = 3
};

/*
 * Side-effect-free C ABI for Go, Rust, Python ctypes and other runtimes.
 *
 * Input strings are borrowed for the duration of the call. Output buffers are
 * caller-owned. On BUFFER_TOO_SMALL, required output counts are still returned
 * and no partial output is written. Database persistence and authorization are
 * outside this library.
 */
uint32_t mycogold_engine_abi_version(void);

int32_t mycogold_match_orders(
    const mycogold_order_input* orders,
    size_t order_count,
    int64_t now_epoch_ms,
    mycogold_fill_output* fills,
    size_t fill_capacity,
    size_t* fill_count,
    mycogold_prevented_output* prevented,
    size_t prevented_capacity,
    size_t* prevented_count,
    char* error_message,
    size_t error_capacity
);

#ifdef __cplusplus
}
#endif
