#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace mycogold::matching {

enum class Side {
  buy,
  sell
};

// Prices are integer KES cents per kilogram; quantities are integer grams.
// These fields avoid floating-point comparisons in the matching decision.
struct Order {
  std::string order_id;
  std::string trader_id;
  std::string commodity_code;
  std::string grade_code;
  std::string market_code;
  Side side{Side::buy};
  std::int64_t limit_price_kes_cents_per_kg{};
  std::int64_t quantity_grams{};
  std::uint64_t priority_sequence{};
  std::int64_t expires_at_epoch_ms{};
};

struct Fill {
  std::string buy_order_id;
  std::string sell_order_id;
  std::string buyer_id;
  std::string seller_id;
  std::string commodity_code;
  std::string grade_code;
  std::string market_code;
  std::int64_t execution_price_kes_cents_per_kg{};
  std::int64_t quantity_grams{};
  std::uint64_t maker_priority_sequence{};
};

struct MatchResult {
  std::vector<Fill> fills;
  // Policy: when a crossing best bid and ask belong to the same trader,
  // cancel the newer order from this matching proposal. The caller must
  // persist this instruction transactionally; this library changes no state.
  std::vector<std::string> self_trade_prevented_order_ids;
};

// Matches one commodity + grade + market book using price-time priority.
// Only active, authorized orders should be supplied by the caller.
// Expired orders are ignored. The function is deterministic and side-effect free.
MatchResult match_orders(
    const std::vector<Order>& active_orders,
    std::int64_t now_epoch_ms
);

}  // namespace mycogold::matching
