#include "mycogold/order_book.hpp"

#include <cstdlib>
#include <iostream>
#include <stdexcept>
#include <string>
#include <utility>
#include <unordered_map>
#include <vector>

using mycogold::matching::Order;
using mycogold::matching::Side;
using mycogold::matching::match_orders;

namespace {

void require(bool condition, const char* message) {
  if (!condition) {
    std::cerr << "FAIL: " << message << '\n';
    std::exit(EXIT_FAILURE);
  }
}

Order order(
    std::string id,
    std::string trader,
    Side side,
    std::int64_t price,
    std::int64_t quantity,
    std::uint64_t sequence,
    std::int64_t expiry = 2'000'000
) {
  return {
      std::move(id), std::move(trader), "TOMATO", "GRADE_1", "NAIROBI",
      side, price, quantity, sequence, expiry, 1
  };
}

}  // namespace

int main() {
  const auto empty = match_orders({}, 1'000'000);
  require(empty.fills.empty(), "empty book has no fills");

  const auto crossed = match_orders({
      order("buy-1", "buyer-a", Side::buy, 12'000, 5'000, 1),
      order("sell-1", "seller-a", Side::sell, 11'000, 3'000, 2),
      order("sell-2", "seller-b", Side::sell, 11'500, 4'000, 3)
  }, 1'000'000);
  require(crossed.fills.size() == 2, "one buy can match multiple sell orders");
  require(crossed.fills[0].quantity_grams == 3'000, "first fill respects seller quantity");
  require(crossed.fills[1].quantity_grams == 2'000, "second fill completes remaining buyer quantity");
  require(crossed.fills[0].execution_price_kes_cents_per_kg == 12'000,
          "older resting buy determines maker execution price");
  require(crossed.fills[0].buyer_id == "buyer-a" &&
          crossed.fills[0].seller_id == "seller-a", "fill identifies both counterparties");
  require(crossed.fills[0].buy_order_version == 1 &&
          crossed.fills[0].sell_order_version == 1,
          "fill echoes the database versions used for matching");

  const auto price_priority = match_orders({
      order("buy-low", "buyer-low", Side::buy, 10'000, 1'000, 1),
      order("buy-high", "buyer-high", Side::buy, 12'000, 1'000, 2),
      order("sell", "seller", Side::sell, 9'000, 1'000, 3)
  }, 1'000'000);
  require(price_priority.fills.size() == 1 &&
          price_priority.fills[0].buy_order_id == "buy-high",
          "highest bid receives priority");

  const auto time_priority = match_orders({
      order("buy-new", "buyer-new", Side::buy, 12'000, 1'000, 2),
      order("buy-old", "buyer-old", Side::buy, 12'000, 1'000, 1),
      order("sell", "seller", Side::sell, 9'000, 1'000, 3)
  }, 1'000'000);
  require(time_priority.fills.size() == 1 &&
          time_priority.fills[0].buy_order_id == "buy-old",
          "earliest sequence wins at equal price");

  const auto not_crossed = match_orders({
      order("buy", "buyer", Side::buy, 9'000, 1'000, 1),
      order("sell", "seller", Side::sell, 10'000, 1'000, 2)
  }, 1'000'000);
  require(not_crossed.fills.empty(), "non-crossing orders do not trade");

  const auto expired = match_orders({
      order("buy-expired", "buyer", Side::buy, 12'000, 1'000, 1, 999'999),
      order("sell-live", "seller", Side::sell, 10'000, 1'000, 2)
  }, 1'000'000);
  require(expired.fills.empty(), "expired order is ignored");

  const auto self_trade = match_orders({
      order("own-ask", "same-trader", Side::sell, 9'000, 1'000, 1),
      order("own-bid", "same-trader", Side::buy, 12'000, 1'000, 3),
      order("other-bid", "other-buyer", Side::buy, 11'000, 1'000, 2)
  }, 1'000'000);
  require(self_trade.self_trade_prevented_order_ids.size() == 1 &&
          self_trade.self_trade_prevented_order_ids[0] == "own-bid",
          "newer self-crossing order is returned for prevention");
  require(self_trade.fills.size() == 1 &&
          self_trade.fills[0].buy_order_id == "other-bid",
          "matching continues after self-trade prevention");

  bool rejected = false;
  try {
    (void)match_orders({
        order("same-id", "buyer", Side::buy, 12'000, 1'000, 1),
        order("same-id", "seller", Side::sell, 10'000, 1'000, 2)
    }, 1'000'000);
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  require(rejected, "duplicate order IDs are rejected");

  rejected = false;
  try {
    (void)match_orders({
        order("buy-seq", "buyer", Side::buy, 12'000, 1'000, 7),
        order("sell-seq", "seller", Side::sell, 10'000, 1'000, 7)
    }, 1'000'000);
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  require(rejected, "duplicate priority sequences are rejected");

  rejected = false;
  try {
    auto wrong_book = order("other-market", "seller", Side::sell, 10'000, 1'000, 2);
    wrong_book.market_code = "NYERI";
    (void)match_orders({
        order("buy", "buyer", Side::buy, 12'000, 1'000, 1),
        wrong_book
    }, 1'000'000);
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  require(rejected, "orders from different market books are rejected");

  rejected = false;
  try {
    (void)match_orders({
        order("bad-quantity", "buyer", Side::buy, 12'000, 0, 1)
    }, 1'000'000);
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  require(rejected, "zero quantity is rejected");

  rejected = false;
  try {
    auto stale = order("zero-version", "buyer", Side::buy, 12'000, 1'000, 1);
    stale.version = 0;
    (void)match_orders({stale}, 1'000'000);
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  require(rejected, "zero database row version is rejected");

  auto versioned_buy = order("versioned-buy", "buyer-v", Side::buy, 12'000, 1'000, 1);
  auto versioned_sell = order("versioned-sell", "seller-v", Side::sell, 10'000, 1'000, 2);
  versioned_buy.version = 7;
  versioned_sell.version = 11;
  const auto versioned = match_orders({versioned_buy, versioned_sell}, 1'000'000);
  require(versioned.fills.size() == 1 &&
          versioned.fills[0].buy_order_version == 7 &&
          versioned.fills[0].sell_order_version == 11,
          "each proposed fill preserves its exact source row versions");

  const auto repeated = match_orders({versioned_buy, versioned_sell}, 1'000'000);
  require(repeated.fills.size() == versioned.fills.size() &&
          repeated.fills[0].buy_order_id == versioned.fills[0].buy_order_id &&
          repeated.fills[0].sell_order_id == versioned.fills[0].sell_order_id &&
          repeated.fills[0].execution_price_kes_cents_per_kg ==
              versioned.fills[0].execution_price_kes_cents_per_kg,
          "identical snapshots produce deterministic fill output");

  std::vector<Order> property_orders;
  property_orders.reserve(40);
  std::unordered_map<std::string, const Order*> orders_by_id;
  for (std::int64_t i = 0; i < 20; ++i) {
    property_orders.push_back(order(
        "property-buy-" + std::to_string(i),
        "property-buyer-" + std::to_string(i),
        Side::buy, 12'000 + (i % 7) * 100, 1'000 + (i % 3) * 500,
        static_cast<std::uint64_t>(i * 2 + 1)));
    property_orders.push_back(order(
        "property-sell-" + std::to_string(i),
        "property-seller-" + std::to_string(i),
        Side::sell, 10'000 + (i % 9) * 100, 1'000 + (i % 4) * 400,
        static_cast<std::uint64_t>(i * 2 + 2)));
  }
  for (const auto& item : property_orders) {
    orders_by_id.emplace(item.order_id, &item);
  }

  const auto property_result = match_orders(property_orders, 1'000'000);
  std::unordered_map<std::string, std::int64_t> buy_filled;
  std::unordered_map<std::string, std::int64_t> sell_filled;
  for (const auto& fill : property_result.fills) {
    const auto buy = orders_by_id.at(fill.buy_order_id);
    const auto sell = orders_by_id.at(fill.sell_order_id);
    require(fill.quantity_grams > 0, "property fill quantity is positive");
    require(buy->side == Side::buy && sell->side == Side::sell,
            "property fill preserves buy and sell sides");
    require(buy->limit_price_kes_cents_per_kg >= fill.execution_price_kes_cents_per_kg &&
            fill.execution_price_kes_cents_per_kg >= sell->limit_price_kes_cents_per_kg,
            "property fill execution price respects both limit prices");
    require(fill.buy_order_version == buy->version &&
            fill.sell_order_version == sell->version,
            "property fill preserves source versions");
    buy_filled[fill.buy_order_id] += fill.quantity_grams;
    sell_filled[fill.sell_order_id] += fill.quantity_grams;
  }
  for (const auto& item : property_orders) {
    const auto& totals = item.side == Side::buy ? buy_filled : sell_filled;
    const auto found = totals.find(item.order_id);
    const std::int64_t filled = found == totals.end() ? 0 : found->second;
    require(filled <= item.quantity_grams, "aggregate fills never exceed source order quantity");
  }

  const auto property_repeat = match_orders(property_orders, 1'000'000);
  require(property_repeat.fills.size() == property_result.fills.size(),
          "larger deterministic snapshot returns a stable fill count");
  for (std::size_t i = 0; i < property_result.fills.size(); ++i) {
    require(property_repeat.fills[i].buy_order_id == property_result.fills[i].buy_order_id &&
            property_repeat.fills[i].sell_order_id == property_result.fills[i].sell_order_id &&
            property_repeat.fills[i].quantity_grams == property_result.fills[i].quantity_grams &&
            property_repeat.fills[i].execution_price_kes_cents_per_kg ==
                property_result.fills[i].execution_price_kes_cents_per_kg,
            "larger deterministic snapshot reproduces every proposed fill");
  }

  std::cout << "All C++ order-book tests passed.\n";
  return EXIT_SUCCESS;
}
