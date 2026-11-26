#include "mycogold/c_api.h"

#include <cstdlib>
#include <cstring>
#include <iostream>

namespace {

void require(bool condition, const char* message) {
  if (!condition) {
    std::cerr << "FAIL: " << message << '\n';
    std::exit(EXIT_FAILURE);
  }
}

}  // namespace

int main() {
  require(mycogold_engine_abi_version() == 1, "C ABI version is explicitly exposed");
  mycogold_order_input orders[] = {
      {"buy-1", "buyer-1", "TOMATO", "GRADE_1", "NAIROBI",
       0, 12'000, 2'000, 1, 2'000'000, 7},
      {"sell-1", "seller-1", "TOMATO", "GRADE_1", "NAIROBI",
       1, 10'000, 1'000, 2, 2'000'000, 11},
  };
  mycogold_fill_output fills[2]{};
  mycogold_prevented_output prevented[2]{};
  size_t fill_count = 0;
  size_t prevented_count = 0;
  char error[256]{};

  const auto status = mycogold_match_orders(
      orders, 2, 1'000'000,
      fills, 2, &fill_count,
      prevented, 2, &prevented_count,
      error, sizeof(error));

  require(status == MYCOGOLD_ENGINE_OK, "valid C ABI request succeeds");
  require(fill_count == 1 && prevented_count == 0, "C ABI returns expected output counts");
  require(fills[0].buy_order_index == 0 && fills[0].sell_order_index == 1,
          "C ABI maps native fills back to stable input indices");
  require(fills[0].quantity_grams == 1'000 &&
          fills[0].execution_price_kes_cents_per_kg == 12'000,
          "C ABI preserves native fill price and quantity");
  require(fills[0].buy_order_version == 7 && fills[0].sell_order_version == 11,
          "C ABI preserves source row versions");

  fill_count = 0;
  prevented_count = 0;
  const auto small_buffer_status = mycogold_match_orders(
      orders, 2, 1'000'000,
      nullptr, 0, &fill_count,
      nullptr, 0, &prevented_count,
      error, sizeof(error));
  require(small_buffer_status == MYCOGOLD_ENGINE_BUFFER_TOO_SMALL,
          "undersized output buffers are rejected without partial writes");
  require(fill_count == 1 && prevented_count == 0,
          "undersized output reports the required buffer sizes");

  orders[0].side = 9;
  const auto invalid_status = mycogold_match_orders(
      orders, 2, 1'000'000,
      fills, 2, &fill_count,
      prevented, 2, &prevented_count,
      error, sizeof(error));
  require(invalid_status == MYCOGOLD_ENGINE_INVALID_ARGUMENT,
          "invalid C ABI side is rejected");
  require(std::strlen(error) > 0, "C ABI returns a bounded diagnostic");

  char oversized_id[130];
  for (size_t i = 0; i < sizeof(oversized_id) - 1; ++i) oversized_id[i] = 'x';
  oversized_id[sizeof(oversized_id) - 1] = '\0';
  orders[0].side = 0;
  orders[0].order_id = oversized_id;
  const auto oversized_status = mycogold_match_orders(
      orders, 2, 1'000'000,
      fills, 2, &fill_count,
      prevented, 2, &prevented_count,
      error, sizeof(error));
  require(oversized_status == MYCOGOLD_ENGINE_INVALID_ARGUMENT,
          "oversized C ABI strings are rejected before unbounded allocation");
  std::cout << "All C ABI tests passed.\n";
  return EXIT_SUCCESS;
}
