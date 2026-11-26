#pragma once
#include <string>
#include <vector>
namespace mycogold::rules {
enum class Metric { quality_remaining, temperature_c, available_quantity_grams, trust_score };
enum class Comparison { less_than, less_or_equal, greater_than, greater_or_equal };
struct Predicate { Metric metric; Comparison comparison; double threshold; };
struct Policy { std::string policy_id; std::vector<Predicate> all_of; };
struct Evaluation { bool accepted; std::vector<std::size_t> failed_predicates; };
// A bounded, declarative rule evaluator. It does not execute user code.
Evaluation evaluate(const Policy& policy, const std::vector<double>& metrics);
}