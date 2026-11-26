#include "mycogold/market_index.hpp"

#include <cmath>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>

using mycogold::market::IndexConfig;
using mycogold::market::PublicationStatus;
using mycogold::market::VerifiedTrade;
using mycogold::market::calculate_mfpi;

namespace {
void require(bool condition, const char* message) {
  if (!condition) {
    std::cerr << "FAIL: " << message << '\n';
    std::exit(EXIT_FAILURE);
  }
}
std::vector<VerifiedTrade> trades(std::size_t count) {
  std::vector<VerifiedTrade> result;
  for (std::size_t i = 0; i < count; ++i) {
    result.push_back({100.0, 10.0, "buyer-" + std::to_string(i % 5),
                      "seller-" + std::to_string(i % 5)});
  }
  return result;
}
}

int main() {
  const auto empty = calculate_mfpi({});
  require(empty.status == PublicationStatus::unpublished, "empty dataset stays unpublished");

  const auto weighted = calculate_mfpi({
      {100.0, 10.0, "buyer-a", "seller-a"},
      {50.0, 10.0, "buyer-b", "seller-b"}});
  require(std::abs(weighted.weighted_price_kes - 75.0) < 1e-9, "VWAP known answer");
  require(weighted.status == PublicationStatus::unpublished, "two trades are not publishable");

  const auto indicative = calculate_mfpi(trades(3));
  require(indicative.status == PublicationStatus::indicative, "three trades are indicative");

  const auto verified = calculate_mfpi(trades(10));
  require(verified.status == PublicationStatus::verified_live, "ten trades and counterparties verify");
  require(verified.distinct_counterparties == 10, "counterparty count is distinct IDs");

  auto with_outlier = trades(10);
  with_outlier.push_back({1000.0, 100.0, "buyer-outlier", "seller-outlier"});
  const auto filtered = calculate_mfpi(with_outlier);
  require(filtered.rejected_outliers == 1, "30 percent median guard excludes outlier");
  require(std::abs(filtered.weighted_price_kes - 100.0) < 1e-9, "outlier does not distort VWAP");

  bool rejected = false;
  try {
    (void)calculate_mfpi({{0.0, 10.0, "buyer", "seller"}});
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  require(rejected, "zero price is rejected");

  rejected = false;
  try {
    (void)calculate_mfpi({{100.0, std::numeric_limits<double>::infinity(), "buyer", "seller"}});
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  require(rejected, "non-finite quantity is rejected");

  IndexConfig volume_gate;
  volume_gate.minimum_volume_kg = 1000.0;
  require(calculate_mfpi(trades(10), volume_gate).status == PublicationStatus::unpublished,
          "minimum volume gate prevents publication");

  IndexConfig large_price_config;
  large_price_config.base_weighted_price_kes = 1.7e308;
  const auto large_even_sample = calculate_mfpi({
      {1.7e308, 1.0, "buyer-1", "seller-1"},
      {1.7e308, 1.0, "buyer-2", "seller-2"},
      {1.7e308, 1.0, "buyer-3", "seller-3"},
      {1.7e308, 1.0, "buyer-4", "seller-4"},
  }, large_price_config);
  require(std::isfinite(large_even_sample.weighted_price_kes),
          "even-sample median and VWAP remain finite for large finite values");

  IndexConfig overflow_config;
  overflow_config.base_weighted_price_kes = std::numeric_limits<double>::min();
  rejected = false;
  try {
    (void)calculate_mfpi(trades(3), overflow_config);
  } catch (const std::overflow_error&) {
    rejected = true;
  }
  require(rejected, "MFPI rejects an unrepresentable final index instead of publishing infinity");

  std::cout << "All C++ market-index tests passed.\n";
  return EXIT_SUCCESS;
}
