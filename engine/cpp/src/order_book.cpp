#include "mycogold/order_book.hpp"

#include <algorithm>
#include <cctype>
#include <stdexcept>
#include <unordered_set>
#include <utility>
#include <vector>

namespace mycogold::matching {
namespace {

bool has_non_whitespace(const std::string& value) {
  return std::any_of(value.begin(), value.end(), [](unsigned char character) {
    return std::isspace(character) == 0;
  });
}

void validate_order(const Order& order) {
  if (!has_non_whitespace(order.order_id) ||
      !has_non_whitespace(order.trader_id) ||
      !has_non_whitespace(order.commodity_code) ||
      !has_non_whitespace(order.grade_code) ||
      !has_non_whitespace(order.market_code) ||
      order.limit_price_kes_cents_per_kg <= 0 ||
      order.quantity_grams <= 0 ||
      order.priority_sequence == 0 ||
      order.expires_at_epoch_ms <= 0 ||
      order.version == 0 ||
      (order.side != Side::buy && order.side != Side::sell)) {
    throw std::invalid_argument("Order contains invalid identity, book, price, quantity, side or time fields");
  }
}

bool older_priority(const Order& left, const Order& right) {
  if (left.priority_sequence != right.priority_sequence) {
    return left.priority_sequence < right.priority_sequence;
  }
  return left.order_id < right.order_id;
}

struct WorkingOrder {
  const Order* order{};
  std::int64_t remaining_grams{};
};

}  // namespace

MatchResult match_orders(
    const std::vector<Order>& active_orders,
    const std::int64_t now_epoch_ms
) {
  if (now_epoch_ms <= 0) {
    throw std::invalid_argument("Matching time must be a positive Unix epoch timestamp in milliseconds");
  }

  MatchResult result;
  if (active_orders.empty()) return result;

  std::unordered_set<std::string> seen_ids;
  std::unordered_set<std::uint64_t> seen_priority_sequences;
  seen_ids.reserve(active_orders.size());
  seen_priority_sequences.reserve(active_orders.size());

  const auto& first = active_orders.front();
  for (const auto& order : active_orders) {
    validate_order(order);
    if (!seen_ids.insert(order.order_id).second) {
      throw std::invalid_argument("Order IDs must be unique within a matching request");
    }
    if (!seen_priority_sequences.insert(order.priority_sequence).second) {
      throw std::invalid_argument("Priority sequences must be globally unique within a matching request");
    }
    if (order.commodity_code != first.commodity_code ||
        order.grade_code != first.grade_code ||
        order.market_code != first.market_code) {
      throw std::invalid_argument("A matching request must contain exactly one commodity, grade and market book");
    }
  }

  std::vector<WorkingOrder> buys;
  std::vector<WorkingOrder> sells;
  buys.reserve(active_orders.size());
  sells.reserve(active_orders.size());

  for (const auto& order : active_orders) {
    if (order.expires_at_epoch_ms <= now_epoch_ms) continue;
    WorkingOrder working{&order, order.quantity_grams};
    if (order.side == Side::buy) {
      buys.push_back(working);
    } else {
      sells.push_back(working);
    }
  }

  std::sort(buys.begin(), buys.end(), [](const WorkingOrder& left, const WorkingOrder& right) {
    if (left.order->limit_price_kes_cents_per_kg != right.order->limit_price_kes_cents_per_kg) {
      return left.order->limit_price_kes_cents_per_kg > right.order->limit_price_kes_cents_per_kg;
    }
    return older_priority(*left.order, *right.order);
  });

  std::sort(sells.begin(), sells.end(), [](const WorkingOrder& left, const WorkingOrder& right) {
    if (left.order->limit_price_kes_cents_per_kg != right.order->limit_price_kes_cents_per_kg) {
      return left.order->limit_price_kes_cents_per_kg < right.order->limit_price_kes_cents_per_kg;
    }
    return older_priority(*left.order, *right.order);
  });

  std::size_t buy_index = 0;
  std::size_t sell_index = 0;

  while (buy_index < buys.size() && sell_index < sells.size()) {
    auto& buy = buys[buy_index];
    auto& sell = sells[sell_index];

    if (buy.remaining_grams == 0) {
      ++buy_index;
      continue;
    }
    if (sell.remaining_grams == 0) {
      ++sell_index;
      continue;
    }

    if (buy.order->limit_price_kes_cents_per_kg <
        sell.order->limit_price_kes_cents_per_kg) {
      break;
    }

    if (buy.order->trader_id == sell.order->trader_id) {
      const Order& newer = older_priority(*buy.order, *sell.order)
          ? *sell.order
          : *buy.order;
      result.self_trade_prevented_order_ids.push_back(newer.order_id);
      if (&newer == buy.order) {
        buy.remaining_grams = 0;
        ++buy_index;
      } else {
        sell.remaining_grams = 0;
        ++sell_index;
      }
      continue;
    }

    const std::int64_t fill_quantity =
        std::min(buy.remaining_grams, sell.remaining_grams);
    const Order& maker = older_priority(*buy.order, *sell.order)
        ? *buy.order
        : *sell.order;

    result.fills.push_back({
        buy.order->order_id,
        sell.order->order_id,
        buy.order->trader_id,
        sell.order->trader_id,
        buy.order->commodity_code,
        buy.order->grade_code,
        buy.order->market_code,
        maker.limit_price_kes_cents_per_kg,
        fill_quantity,
        maker.priority_sequence,
        buy.order->version,
        sell.order->version
    });

    buy.remaining_grams -= fill_quantity;
    sell.remaining_grams -= fill_quantity;
  }

  return result;
}

}  // namespace mycogold::matching
