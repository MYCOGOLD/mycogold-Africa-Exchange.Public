#include "mycogold/db.hpp"
#include "mycogold/util.hpp"
#include <algorithm>
#include <stdexcept>
#include <unordered_map>
namespace mycogold::persistence {
void validate_snapshot(const Snapshot& snapshot) {
  mycogold::core::require_identifier(snapshot.snapshot_id, "snapshot_id");
  if (snapshot.captured_at_epoch_ms <= 0 || snapshot.orders.size() > 500000)
    throw std::invalid_argument("Database snapshot time or size is invalid");
  std::unordered_map<std::string, const matching::Order*> ids;
  ids.reserve(snapshot.orders.size());
  for (const auto& order : snapshot.orders) {
    if (!ids.emplace(order.order_id, &order).second || order.version == 0 ||
        order.quantity_grams <= 0 || order.limit_price_kes_cents_per_kg <= 0)
      throw std::invalid_argument("Database snapshot contains duplicate or invalid order rows");
  }
}
void validate_commit_intent(const Snapshot& snapshot, const CommitIntent& intent) {
  validate_snapshot(snapshot);
  mycogold::core::require_identifier(intent.idempotency_key, "idempotency_key");
  if (intent.snapshot_id != snapshot.snapshot_id || intent.fills.size() > 500000)
    throw std::invalid_argument("Commit intent does not refer to the supplied snapshot");
  std::unordered_map<std::string, const matching::Order*> by_id;
  std::unordered_map<std::string, std::int64_t> totals;
  by_id.reserve(snapshot.orders.size());
  for (const auto& order : snapshot.orders) by_id.emplace(order.order_id, &order);
  for (const auto& fill : intent.fills) {
    const auto buy = by_id.find(fill.buy_order_id), sell = by_id.find(fill.sell_order_id);
    if (buy == by_id.end() || sell == by_id.end() || fill.quantity_grams <= 0 ||
        buy->second->side != matching::Side::buy || sell->second->side != matching::Side::sell ||
        buy->second->version != fill.buy_order_version || sell->second->version != fill.sell_order_version ||
        buy->second->trader_id == sell->second->trader_id ||
        fill.execution_price_kes_cents_per_kg > buy->second->limit_price_kes_cents_per_kg ||
        fill.execution_price_kes_cents_per_kg < sell->second->limit_price_kes_cents_per_kg)
      throw std::invalid_argument("Proposed fill violates snapshot identity, version, side or price constraints");
    if (totals[fill.buy_order_id] > buy->second->quantity_grams - fill.quantity_grams ||
        totals[fill.sell_order_id] > sell->second->quantity_grams - fill.quantity_grams)
      throw std::invalid_argument("Proposed fills exceed the source order quantity");
    totals[fill.buy_order_id] += fill.quantity_grams;
    totals[fill.sell_order_id] += fill.quantity_grams;
  }
}
}