#include "mycogold/db.hpp"
#include "mycogold/util.hpp"
#include <stdexcept>
#include <unordered_map>

namespace mycogold::persistence {

void validate_snapshot(const Snapshot& snapshot) {
  mycogold::core::require_identifier(snapshot.snapshot_id, "snapshot_id");
  if (snapshot.captured_at_epoch_ms <= 0 || snapshot.orders.size() > 500000) {
    throw std::invalid_argument("Database snapshot time or size is invalid");
  }

  std::unordered_map<std::string, const matching::Order*> ids;
  ids.reserve(snapshot.orders.size());
  for (const auto& order : snapshot.orders) {
    if (!mycogold::core::is_safe_identifier(order.order_id) ||
        !mycogold::core::is_safe_identifier(order.trader_id) ||
        !mycogold::core::is_safe_identifier(order.commodity_code) ||
        !mycogold::core::is_safe_identifier(order.grade_code) ||
        !mycogold::core::is_safe_identifier(order.market_code) ||
        !ids.emplace(order.order_id, &order).second || order.version == 0 ||
        order.quantity_grams <= 0 || order.limit_price_kes_cents_per_kg <= 0 ||
        order.priority_sequence == 0 ||
        order.expires_at_epoch_ms <= snapshot.captured_at_epoch_ms ||
        (order.side != matching::Side::buy && order.side != matching::Side::sell)) {
      throw std::invalid_argument("Database snapshot contains duplicate or invalid active order rows");
    }
  }
}

void validate_commit_intent(const Snapshot& snapshot, const CommitIntent& intent) {
  validate_snapshot(snapshot);
  mycogold::core::require_identifier(intent.idempotency_key, "idempotency_key");
  if (intent.snapshot_id != snapshot.snapshot_id || intent.fills.size() > 500000) {
    throw std::invalid_argument("Commit intent does not refer to the supplied snapshot");
  }

  std::unordered_map<std::string, const matching::Order*> by_id;
  std::unordered_map<std::string, std::int64_t> totals;
  by_id.reserve(snapshot.orders.size());
  for (const auto& order : snapshot.orders) by_id.emplace(order.order_id, &order);

  for (const auto& fill : intent.fills) {
    const auto buy = by_id.find(fill.buy_order_id);
    const auto sell = by_id.find(fill.sell_order_id);
    const bool buy_is_maker = buy != by_id.end() &&
        fill.maker_priority_sequence == buy->second->priority_sequence;
    const bool sell_is_maker = sell != by_id.end() &&
        fill.maker_priority_sequence == sell->second->priority_sequence;
    if (buy == by_id.end() || sell == by_id.end() || fill.quantity_grams <= 0 ||
        buy->second->side != matching::Side::buy ||
        sell->second->side != matching::Side::sell ||
        buy->second->version != fill.buy_order_version ||
        sell->second->version != fill.sell_order_version ||
        buy->second->trader_id == sell->second->trader_id ||
        fill.buyer_id != buy->second->trader_id ||
        fill.seller_id != sell->second->trader_id ||
        fill.commodity_code != buy->second->commodity_code ||
        fill.grade_code != buy->second->grade_code ||
        fill.market_code != buy->second->market_code ||
        sell->second->commodity_code != buy->second->commodity_code ||
        sell->second->grade_code != buy->second->grade_code ||
        sell->second->market_code != buy->second->market_code ||
        buy_is_maker == sell_is_maker ||
        fill.execution_price_kes_cents_per_kg !=
            (buy_is_maker ? buy->second->limit_price_kes_cents_per_kg
                          : sell->second->limit_price_kes_cents_per_kg) ||
        fill.execution_price_kes_cents_per_kg <= 0 ||
        fill.execution_price_kes_cents_per_kg > buy->second->limit_price_kes_cents_per_kg ||
        fill.execution_price_kes_cents_per_kg < sell->second->limit_price_kes_cents_per_kg) {
      throw std::invalid_argument("Proposed fill violates snapshot identity, version, side, book or price constraints");
    }

    const auto buy_used = totals[fill.buy_order_id];
    const auto sell_used = totals[fill.sell_order_id];
    if (buy_used > buy->second->quantity_grams ||
        sell_used > sell->second->quantity_grams ||
        fill.quantity_grams > buy->second->quantity_grams - buy_used ||
        fill.quantity_grams > sell->second->quantity_grams - sell_used) {
      throw std::invalid_argument("Proposed fills exceed the source order quantity");
    }
    totals[fill.buy_order_id] += fill.quantity_grams;
    totals[fill.sell_order_id] += fill.quantity_grams;
  }
}

}  // namespace mycogold::persistence
