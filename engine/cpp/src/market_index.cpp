#include "mycogold/market_index.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <unordered_set>
#include <stdexcept>
#include <utility>
#include <vector>

namespace mycogold::market {
namespace {

bool valid_trade(const VerifiedTrade& trade) {
  return std::isfinite(trade.price_kes_per_kg) &&
         std::isfinite(trade.quantity_kg) &&
         trade.price_kes_per_kg > 0.0 &&
         trade.quantity_kg > 0.0 &&
         !trade.buyer_id.empty() &&
         !trade.seller_id.empty() &&
         trade.buyer_id != trade.seller_id;
}

double median(std::vector<double> values) {
  if (values.empty()) return 0.0;
  const auto middle = values.size() / 2;
  std::nth_element(values.begin(), values.begin() + static_cast<std::ptrdiff_t>(middle), values.end());
  const double upper = values[middle];
  if (values.size() % 2 != 0) return upper;
  std::nth_element(values.begin(), values.begin() + static_cast<std::ptrdiff_t>(middle - 1),
                   values.begin() + static_cast<std::ptrdiff_t>(middle));
  return values[middle - 1] / 2.0 + upper / 2.0;
}

}  // namespace

IndexResult calculate_mfpi(
    const std::vector<VerifiedTrade>& settled_trades,
    const IndexConfig& config
) {
  if (config.indicative_trade_count == 0 ||
      config.verified_trade_count < config.indicative_trade_count ||
      config.verified_counterparty_count == 0 ||
      !std::isfinite(config.minimum_volume_kg) || config.minimum_volume_kg < 0.0 ||
      !std::isfinite(config.outlier_band) || config.outlier_band < 0.0 ||
      config.outlier_band >= 1.0 ||
      !std::isfinite(config.base_index) || config.base_index <= 0.0 ||
      !std::isfinite(config.base_weighted_price_kes) || config.base_weighted_price_kes <= 0.0) {
    throw std::invalid_argument("Invalid MFPI configuration");
  }

  std::vector<double> prices;
  prices.reserve(settled_trades.size());
  for (const auto& trade : settled_trades) {
    if (!valid_trade(trade)) {
      throw std::invalid_argument("Trade input must contain positive finite prices, quantities and distinct counterparties");
    }
    prices.push_back(trade.price_kes_per_kg);
  }

  IndexResult result;
  if (prices.empty()) return result;

  // Do not apply a statistical outlier filter to fewer than three observations.
  // With tiny samples the median guard can incorrectly reject every valid trade.
  const bool apply_outlier_guard = prices.size() >= 3;
  const double reference = apply_outlier_guard ? median(prices) : 0.0;
  const double lower = apply_outlier_guard ? reference * (1.0 - config.outlier_band) : 0.0;
  const double upper = apply_outlier_guard ? reference * (1.0 + config.outlier_band)
                                           : std::numeric_limits<double>::infinity();
  long double weighted_sum = 0.0L;
  long double volume_sum = 0.0L;
  std::unordered_set<std::string> counterparties;
  counterparties.reserve(settled_trades.size() * 2);

  for (const auto& trade : settled_trades) {
    if (trade.price_kes_per_kg < lower || trade.price_kes_per_kg > upper) {
      ++result.rejected_outliers;
      continue;
    }
    weighted_sum += static_cast<long double>(trade.price_kes_per_kg) *
                    static_cast<long double>(trade.quantity_kg);
    volume_sum += static_cast<long double>(trade.quantity_kg);
    ++result.accepted_trades;
    counterparties.insert(trade.buyer_id);
    counterparties.insert(trade.seller_id);
  }

  if (volume_sum <= 0.0L ||
      volume_sum > static_cast<long double>(std::numeric_limits<double>::max()) ||
      weighted_sum > static_cast<long double>(std::numeric_limits<double>::max())) {
    return result;
  }

  result.accepted_volume_kg = static_cast<double>(volume_sum);
  result.distinct_counterparties = counterparties.size();
  if (result.accepted_trades == 0 || result.accepted_volume_kg < config.minimum_volume_kg) {
    return result;
  }

  result.weighted_price_kes = static_cast<double>(weighted_sum / volume_sum);
  if (!std::isfinite(result.weighted_price_kes) || result.weighted_price_kes <= 0.0) {
    throw std::overflow_error("VWAP is outside the supported numeric range");
  }

  const long double index = static_cast<long double>(config.base_index) +
      ((static_cast<long double>(result.weighted_price_kes) -
        static_cast<long double>(config.base_weighted_price_kes)) /
       static_cast<long double>(config.base_weighted_price_kes) * 100.0L);
  if (!std::isfinite(index) ||
      std::abs(index) > static_cast<long double>(std::numeric_limits<double>::max())) {
    throw std::overflow_error("MFPI result is outside the supported numeric range");
  }
  result.mfpi = static_cast<double>(index);

  if (result.accepted_trades >= config.verified_trade_count &&
      result.distinct_counterparties >= config.verified_counterparty_count) {
    result.status = PublicationStatus::verified_live;
  } else if (result.accepted_trades >= config.indicative_trade_count) {
    result.status = PublicationStatus::indicative;
  }
  return result;
}

const char* to_string(PublicationStatus status) noexcept {
  switch (status) {
    case PublicationStatus::unpublished: return "UNPUBLISHED";
    case PublicationStatus::indicative: return "INDICATIVE";
    case PublicationStatus::verified_live: return "VERIFIED_LIVE";
  }
  return "UNPUBLISHED";
}

}  // namespace mycogold::market
