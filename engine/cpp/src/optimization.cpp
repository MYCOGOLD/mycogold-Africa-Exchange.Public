#include "mycogold/optimization.hpp"
#include <algorithm>
#include <cmath>
#include <limits>
#include <random>
#include <stdexcept>
#include <unordered_set>
#include <utility>
namespace mycogold::optimization {
namespace {
struct Neighbor { std::size_t index; double coefficient; };
double exact_energy(const QuboProblem& p, const std::vector<std::uint8_t>& bits) {
  long double value = p.offset;
  for (std::size_t i = 0; i < bits.size(); ++i) value += static_cast<long double>(p.linear[i]) * bits[i];
  for (const auto& t : p.quadratic) value += static_cast<long double>(t.coefficient) * bits[t.i] * bits[t.j];
  if (!std::isfinite(value) || std::abs(value) > std::numeric_limits<double>::max())
    throw std::invalid_argument("QUBO energy exceeds supported numeric range");
  return static_cast<double>(value);
}
}
Result solve_simulated_annealing(const QuboProblem& p, const Options& o) {
  constexpr std::size_t kMaxVariables = 10000, kMaxTerms = 1000000, kMaxIterations = 2000000;
  if (p.linear.empty() || p.linear.size() > kMaxVariables || p.quadratic.size() > kMaxTerms ||
      !std::isfinite(p.offset) || o.iterations == 0 || o.iterations > kMaxIterations ||
      !std::isfinite(o.initial_temperature) || !std::isfinite(o.final_temperature) ||
      o.initial_temperature <= 0 || o.final_temperature <= 0 ||
      o.final_temperature > o.initial_temperature)
    throw std::invalid_argument("Invalid QUBO dimensions or annealing options");
  for (double c : p.linear) if (!std::isfinite(c)) throw std::invalid_argument("Non-finite linear coefficient");
  std::vector<std::vector<Neighbor>> adjacency(p.linear.size());
  std::unordered_set<std::uint64_t> pairs;
  pairs.reserve(p.quadratic.size());
  for (const auto& t : p.quadratic) {
    if (t.i >= p.linear.size() || t.j >= p.linear.size() || t.i == t.j || !std::isfinite(t.coefficient))
      throw std::invalid_argument("Invalid QUBO quadratic term");
    const auto lo = static_cast<std::uint32_t>(std::min(t.i, t.j));
    const auto hi = static_cast<std::uint32_t>(std::max(t.i, t.j));
    const auto key = (static_cast<std::uint64_t>(lo) << 32) | hi;
    if (!pairs.insert(key).second) throw std::invalid_argument("Duplicate QUBO variable pair");
    adjacency[t.i].push_back({t.j, t.coefficient});
    adjacency[t.j].push_back({t.i, t.coefficient});
  }
  std::mt19937_64 rng(o.seed);
  std::uniform_real_distribution<double> unit(0.0, 1.0);
  std::uniform_int_distribution<std::size_t> choose(0, p.linear.size() - 1);
  std::vector<std::uint8_t> current(p.linear.size());
  for (auto& bit : current) bit = unit(rng) < 0.5 ? 0 : 1;
  double current_energy = exact_energy(p, current);
  auto best = current;
  double best_energy = current_energy;
  const double log_initial = std::log(o.initial_temperature);
  const double log_final = std::log(o.final_temperature);
  for (std::size_t step = 0; step < o.iterations; ++step) {
    const double fraction = o.iterations == 1 ? 1.0 :
        static_cast<double>(step) / static_cast<double>(o.iterations - 1);
    const double temperature = std::exp(log_initial + (log_final - log_initial) * fraction);
    const std::size_t index = choose(rng);
    const double change = current[index] == 0 ? 1.0 : -1.0;
    long double delta = static_cast<long double>(p.linear[index]) * change;
    for (const auto& n : adjacency[index])
      delta += static_cast<long double>(n.coefficient) * change * current[n.index];
    if (!std::isfinite(delta) || std::abs(delta) > std::numeric_limits<double>::max())
      throw std::invalid_argument("QUBO flip delta exceeds supported numeric range");
    const double d = static_cast<double>(delta);
    if (d <= 0.0 || unit(rng) < std::exp(-d / temperature)) {
      current[index] = static_cast<std::uint8_t>(1U - current[index]);
      current_energy += d;
      if (current_energy < best_energy) {
        const double verified = exact_energy(p, current);
        if (verified < best_energy) { best_energy = verified; best = current; }
      }
    }
    if ((step + 1) % 4096 == 0) current_energy = exact_energy(p, current);
  }
  return {std::move(best), best_energy, o.iterations, o.seed, false};
}
}