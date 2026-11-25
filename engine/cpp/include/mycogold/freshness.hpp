#pragma once

#include <cstdint>
#include <vector>

namespace mycogold::freshness {

// Parameters must be calibrated per commodity, variety, packaging and handling
// chain using observed quality measurements before operational decisions rely
// on this model. Rates are illustrative inputs, not universal shelf-life facts.
struct DecayProfile {
  double base_decay_rate_per_hour{};
  double q10{};
  double reference_temperature_c{};
  double marketability_threshold{};
};

struct TemperatureInterval {
  std::int64_t start_epoch_ms{};
  std::int64_t end_epoch_ms{};
  double temperature_c{};
};

struct FreshnessResult {
  double quality_remaining{};
  double cumulative_hazard{};
  double observed_hours{};
  double hours_to_threshold_at_last_temperature{};
};

// Computes quality_remaining = exp(-integral(decay_rate(T) * dt)).
// Temperature intervals must be ordered, contiguous, and end exactly at now.
FreshnessResult estimate_freshness(
    const DecayProfile& profile,
    const std::vector<TemperatureInterval>& temperature_history,
    std::int64_t now_epoch_ms
);

}  // namespace mycogold::freshness
