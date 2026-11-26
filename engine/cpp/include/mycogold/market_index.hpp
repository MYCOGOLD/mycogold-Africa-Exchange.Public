#pragma once

#include <cstddef>
#include <string>
#include <vector>

namespace mycogold::market {

enum class PublicationStatus {
  unpublished,
  indicative,
  verified_live
};

struct VerifiedTrade {
  double price_kes_per_kg{};
  double quantity_kg{};
  std::string buyer_id;
  std::string seller_id;
};

struct IndexConfig {
  std::size_t indicative_trade_count{3};
  std::size_t verified_trade_count{10};
  std::size_t verified_counterparty_count{5};
  double minimum_volume_kg{0.0};
  double outlier_band{0.30};
  double base_index{99.06654};
  double base_weighted_price_kes{52.0};
};

struct IndexResult {
  PublicationStatus status{PublicationStatus::unpublished};
  double weighted_price_kes{};
  double mfpi{};
  double accepted_volume_kg{};
  std::size_t accepted_trades{};
  std::size_t rejected_outliers{};
  std::size_t distinct_counterparties{};
};

IndexResult calculate_mfpi(
    const std::vector<VerifiedTrade>& settled_trades,
    const IndexConfig& config = {}
);

const char* to_string(PublicationStatus status) noexcept;

}  // namespace mycogold::market
