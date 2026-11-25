#include "mycogold/freshness.hpp"

#include <cmath>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <vector>

using mycogold::freshness::DecayProfile;
using mycogold::freshness::TemperatureInterval;
using mycogold::freshness::estimate_freshness;

namespace {

void require(bool condition, const char* message) {
  if (!condition) {
    std::cerr << "FAIL: " << message << '\n';
    std::exit(EXIT_FAILURE);
  }
}

bool near(double left, double right, double tolerance = 1e-10) {
  return std::abs(left - right) <= tolerance;
}

DecayProfile profile() {
  return {0.01, 2.0, 10.0, 0.70};
}

}  // namespace

int main() {
  const auto reference = estimate_freshness(
      profile(), 1'000, {{1'000, 1'000 + 24 * 3'600'000LL, 10.0}},
      1'000 + 24 * 3'600'000LL
  );
  require(near(reference.quality_remaining, std::exp(-0.24)),
          "reference-temperature decay follows exponential hazard");
  require(near(reference.observed_hours, 24.0), "observed time is reported in hours");

  const auto warm = estimate_freshness(
      profile(), 1'000, {{1'000, 1'000 + 24 * 3'600'000LL, 20.0}},
      1'000 + 24 * 3'600'000LL
  );
  require(near(warm.quality_remaining, std::exp(-0.48)),
          "a ten-degree increase doubles decay when Q10 is two");
  require(warm.quality_remaining < reference.quality_remaining,
          "warmer handling reduces estimated remaining quality");

  const auto split = estimate_freshness(
      profile(), 1'000,
      {
          {1'000, 1'000 + 12 * 3'600'000LL, 10.0},
          {1'000 + 12 * 3'600'000LL, 1'000 + 24 * 3'600'000LL, 10.0}
      },
      1'000 + 24 * 3'600'000LL
  );
  require(near(split.quality_remaining, reference.quality_remaining),
          "splitting an unchanged temperature interval preserves the result");

  require(reference.hours_to_threshold_at_last_temperature > 0.0,
          "remaining time is positive above marketability threshold");

  bool rejected = false;
  try {
    (void)estimate_freshness(
        profile(), 1'000,
        {{1'000, 1'000 + 10 * 3'600'000LL, 10.0},
         {1'000 + 11 * 3'600'000LL, 1'000 + 24 * 3'600'000LL, 10.0}},
        1'000 + 24 * 3'600'000LL
    );
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  require(rejected, "missing temperature history intervals are rejected");

  rejected = false;
  try {
    (void)estimate_freshness(
        profile(), 1'000,
        {{1'000, 1'000 + 24 * 3'600'000LL,
          std::numeric_limits<double>::quiet_NaN()}},
        1'000 + 24 * 3'600'000LL
    );
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  require(rejected, "non-finite temperatures are rejected");

  rejected = false;
  try {
    auto invalid = profile();
    invalid.marketability_threshold = 1.0;
    (void)estimate_freshness(
        invalid, 1'000, {{1'000, 1'000 + 3'600'000LL, 10.0}},
        1'000 + 3'600'000LL
    );
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  require(rejected, "invalid marketability thresholds are rejected");

  const auto below_threshold = estimate_freshness(
      profile(), 1'000, {{1'000, 1'000 + 1'000 * 3'600'000LL, 10.0}},
      1'000 + 1'000 * 3'600'000LL
  );
  require(below_threshold.quality_remaining < profile().marketability_threshold,
          "quality below the marketability threshold is reported");
  require(near(below_threshold.hours_to_threshold_at_last_temperature, 0.0),
          "no additional marketable time is reported after threshold crossing");

  rejected = false;
  try {
    (void)estimate_freshness(
        profile(), 1'000, {{1'000, 1'000 + 3'600'000LL, 101.0}},
        1'000 + 3'600'000LL
    );
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  require(rejected, "temperatures outside the supported range are rejected");

  rejected = false;
  try {
    (void)estimate_freshness(
        profile(), 500, {{1'000, 1'000 + 3'600'000LL, 10.0}},
        1'000 + 3'600'000LL
    );
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  require(rejected, "temperature history that starts after harvest is rejected");

  rejected = false;
  try {
    auto overflow_profile = profile();
    overflow_profile.q10 = 1e308;
    (void)estimate_freshness(
        overflow_profile, 1'000, {{1'000, 1'000 + 3'600'000LL, 30.0}},
        1'000 + 3'600'000LL
    );
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  require(rejected, "overflowing temperature response is rejected");

  rejected = false;
  try {
    auto extreme_rate_profile = profile();
    extreme_rate_profile.base_decay_rate_per_hour = 1e308;
    (void)estimate_freshness(
        extreme_rate_profile, 1'000,
        {{1'000, 1'000 + 24 * 3'600'000LL, 10.0}},
        1'000 + 24 * 3'600'000LL
    );
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  require(rejected, "unrepresentable accumulated hazard is rejected");

  std::cout << "All C++ freshness tests passed.\n";
  return EXIT_SUCCESS;
}
