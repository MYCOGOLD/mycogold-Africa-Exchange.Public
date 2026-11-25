#include "mycogold/freshness.hpp"

#include <cmath>
#include <limits>
#include <stdexcept>

namespace mycogold::freshness {
namespace {

constexpr double kMillisecondsPerHour = 3'600'000.0;

void validate_profile(const DecayProfile& profile) {
  if (!std::isfinite(profile.base_decay_rate_per_hour) ||
      profile.base_decay_rate_per_hour <= 0.0 ||
      !std::isfinite(profile.q10) ||
      profile.q10 <= 0.0 ||
      !std::isfinite(profile.reference_temperature_c) ||
      profile.reference_temperature_c < -80.0 ||
      profile.reference_temperature_c > 100.0 ||
      !std::isfinite(profile.marketability_threshold) ||
      profile.marketability_threshold <= 0.0 ||
      profile.marketability_threshold >= 1.0) {
    throw std::invalid_argument("Freshness decay profile contains invalid parameters");
  }
}

double decay_rate_at(const DecayProfile& profile, const double temperature_c) {
  if (!std::isfinite(temperature_c) || temperature_c < -80.0 || temperature_c > 100.0) {
    throw std::invalid_argument("Temperature must be finite and within the supported physical range");
  }

  const double exponent = (temperature_c - profile.reference_temperature_c) / 10.0;
  const double rate = profile.base_decay_rate_per_hour * std::pow(profile.q10, exponent);
  if (!std::isfinite(rate) || rate <= 0.0) {
    throw std::invalid_argument("Temperature produced an invalid decay rate");
  }
  return rate;
}

}  // namespace

FreshnessResult estimate_freshness(
    const DecayProfile& profile,
    const std::int64_t harvest_epoch_ms,
    const std::vector<TemperatureInterval>& temperature_history,
    const std::int64_t now_epoch_ms
) {
  validate_profile(profile);
  if (harvest_epoch_ms <= 0 || now_epoch_ms <= harvest_epoch_ms || temperature_history.empty()) {
    throw std::invalid_argument("Freshness calculation requires a positive time and temperature history");
  }

  long double cumulative_hazard = 0.0L;
  long double observed_milliseconds = 0.0L;
  std::int64_t expected_start = harvest_epoch_ms;

  for (const auto& interval : temperature_history) {
    if (interval.start_epoch_ms != expected_start ||
        interval.end_epoch_ms <= interval.start_epoch_ms ||
        interval.end_epoch_ms > now_epoch_ms) {
      throw std::invalid_argument("Temperature intervals must be ordered, contiguous and not extend beyond now");
    }

    const double rate = decay_rate_at(profile, interval.temperature_c);
    const auto duration_ms = interval.end_epoch_ms - interval.start_epoch_ms;
    const long double duration_hours =
        static_cast<long double>(duration_ms) /
        static_cast<long double>(kMillisecondsPerHour);

    cumulative_hazard += static_cast<long double>(rate) * duration_hours;
    observed_milliseconds += static_cast<long double>(duration_ms);
    expected_start = interval.end_epoch_ms;
  }

  if (!std::isfinite(cumulative_hazard) ||
      cumulative_hazard > static_cast<long double>(std::numeric_limits<double>::max())) {
    throw std::invalid_argument("Accumulated freshness hazard exceeds the supported numeric range");
  }

  if (expected_start != now_epoch_ms) {
    throw std::invalid_argument("Temperature history must cover continuously through the requested calculation time");
  }

  const long double quality = std::exp(-cumulative_hazard);
  const auto& latest_interval = temperature_history.back();
  const double current_rate = decay_rate_at(profile, latest_interval.temperature_c);

  double hours_remaining = 0.0;
  if (quality > static_cast<long double>(profile.marketability_threshold)) {
    hours_remaining = static_cast<double>(
        std::log(quality / static_cast<long double>(profile.marketability_threshold)) /
        static_cast<long double>(current_rate)
    );
  }

  return {
      static_cast<double>(quality),
      static_cast<double>(cumulative_hazard),
      static_cast<double>(observed_milliseconds /
          static_cast<long double>(kMillisecondsPerHour)),
      hours_remaining
  };
}

}  // namespace mycogold::freshness
