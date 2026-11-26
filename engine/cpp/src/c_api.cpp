#include "mycogold/c_api.h"

#include "mycogold/order_book.hpp"

#include <cstdio>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace {

constexpr size_t kMaximumOrdersPerCall = 500'000;

void set_error(char* buffer, size_t capacity, const char* message) noexcept {
  if (buffer == nullptr || capacity == 0) return;
  std::snprintf(buffer, capacity, "%s", message == nullptr ? "Unknown engine error" : message);
}

std::string required_string(const char* value, const char* field) {
  if (value == nullptr) {
    throw std::invalid_argument(std::string(field) + " must not be null");
  }
  constexpr size_t kMaximumFieldBytes = 128;
  size_t length = 0;
  while (length <= kMaximumFieldBytes && value[length] != '\0') ++length;
  if (length == 0 || length > kMaximumFieldBytes) {
    throw std::invalid_argument(std::string(field) + " must contain 1 to 128 bytes");
  }
  return std::string(value, length);
}

}  // namespace

extern "C" uint32_t mycogold_engine_abi_version(void) { return 1; }

extern "C" int32_t mycogold_match_orders(
    const mycogold_order_input* orders,
    const size_t order_count,
    const int64_t now_epoch_ms,
    mycogold_fill_output* fills,
    const size_t fill_capacity,
    size_t* fill_count,
    mycogold_prevented_output* prevented,
    const size_t prevented_capacity,
    size_t* prevented_count,
    char* error_message,
    const size_t error_capacity
) {
  if (fill_count == nullptr || prevented_count == nullptr) {
    set_error(error_message, error_capacity, "Output count pointers must not be null");
    return MYCOGOLD_ENGINE_INVALID_ARGUMENT;
  }
  *fill_count = 0;
  *prevented_count = 0;
  if (error_message != nullptr && error_capacity > 0) error_message[0] = '\0';

  if ((order_count > 0 && orders == nullptr) ||
      (fill_capacity > 0 && fills == nullptr) ||
      (prevented_capacity > 0 && prevented == nullptr) ||
      order_count > kMaximumOrdersPerCall) {
    set_error(error_message, error_capacity, "Invalid input/output buffer or order count");
    return MYCOGOLD_ENGINE_INVALID_ARGUMENT;
  }

  try {
    std::vector<mycogold::matching::Order> native_orders;
    native_orders.reserve(order_count);
    std::unordered_map<std::string, size_t> index_by_order_id;
    index_by_order_id.reserve(order_count);

    for (size_t index = 0; index < order_count; ++index) {
      const auto& source = orders[index];
      if (source.side != 0 && source.side != 1) {
        throw std::invalid_argument("side must be 0 (BUY) or 1 (SELL)");
      }

      mycogold::matching::Order order;
      order.order_id = required_string(source.order_id, "order_id");
      order.trader_id = required_string(source.trader_id, "trader_id");
      order.commodity_code = required_string(source.commodity_code, "commodity_code");
      order.grade_code = required_string(source.grade_code, "grade_code");
      order.market_code = required_string(source.market_code, "market_code");
      order.side = source.side == 0
          ? mycogold::matching::Side::buy
          : mycogold::matching::Side::sell;
      order.limit_price_kes_cents_per_kg = source.limit_price_kes_cents_per_kg;
      order.quantity_grams = source.quantity_grams;
      order.priority_sequence = source.priority_sequence;
      order.expires_at_epoch_ms = source.expires_at_epoch_ms;
      order.version = source.version;

      index_by_order_id.emplace(order.order_id, index);
      native_orders.push_back(std::move(order));
    }

    const auto result = mycogold::matching::match_orders(native_orders, now_epoch_ms);
    *fill_count = result.fills.size();
    *prevented_count = result.self_trade_prevented_order_ids.size();

    if (*fill_count > fill_capacity || *prevented_count > prevented_capacity) {
      set_error(error_message, error_capacity, "Output buffers are too small; required counts were returned");
      return MYCOGOLD_ENGINE_BUFFER_TOO_SMALL;
    }

    for (size_t index = 0; index < result.fills.size(); ++index) {
      const auto& source = result.fills[index];
      const auto buy = index_by_order_id.find(source.buy_order_id);
      const auto sell = index_by_order_id.find(source.sell_order_id);
      if (buy == index_by_order_id.end() || sell == index_by_order_id.end()) {
        throw std::runtime_error("Matcher returned an order ID absent from its input snapshot");
      }
      fills[index] = {
          buy->second,
          sell->second,
          source.execution_price_kes_cents_per_kg,
          source.quantity_grams,
          source.maker_priority_sequence,
          source.buy_order_version,
          source.sell_order_version
      };
    }

    for (size_t index = 0; index < result.self_trade_prevented_order_ids.size(); ++index) {
      const auto found = index_by_order_id.find(result.self_trade_prevented_order_ids[index]);
      if (found == index_by_order_id.end()) {
        throw std::runtime_error("Matcher returned a prevented order ID absent from its input snapshot");
      }
      prevented[index] = {found->second};
    }

    return MYCOGOLD_ENGINE_OK;
  } catch (const std::invalid_argument& error) {
    set_error(error_message, error_capacity, error.what());
    return MYCOGOLD_ENGINE_INVALID_ARGUMENT;
  } catch (const std::exception& error) {
    set_error(error_message, error_capacity, error.what());
    return MYCOGOLD_ENGINE_INTERNAL_ERROR;
  } catch (...) {
    set_error(error_message, error_capacity, "Unknown native matching failure");
    return MYCOGOLD_ENGINE_INTERNAL_ERROR;
  }
}
