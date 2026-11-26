#include "mycogold/script.hpp"
#include "mycogold/util.hpp"
#include <cmath>
#include <stdexcept>
namespace mycogold::rules {
Evaluation evaluate(const Policy& policy, const std::vector<double>& metrics) {
  if (!mycogold::core::is_safe_identifier(policy.policy_id) || policy.all_of.size() > 128 || metrics.size() > 128)
    throw std::invalid_argument("Policy identity or predicate count is invalid");
  Evaluation result{true, {}};
  for (std::size_t i = 0; i < policy.all_of.size(); ++i) {
    const auto& predicate = policy.all_of[i];
    const auto index = static_cast<std::size_t>(predicate.metric);
    if (index >= metrics.size() || !std::isfinite(metrics[index]) || !std::isfinite(predicate.threshold))
      throw std::invalid_argument("Policy references a missing or non-finite metric");
    const double value = metrics[index];
    bool passed = false;
    switch (predicate.comparison) {
      case Comparison::less_than: passed = value < predicate.threshold; break;
      case Comparison::less_or_equal: passed = value <= predicate.threshold; break;
      case Comparison::greater_than: passed = value > predicate.threshold; break;
      case Comparison::greater_or_equal: passed = value >= predicate.threshold; break;
      default: throw std::invalid_argument("Unknown policy comparison");
    }
    if (!passed) { result.accepted = false; result.failed_predicates.push_back(i); }
  }
  return result;
}
}