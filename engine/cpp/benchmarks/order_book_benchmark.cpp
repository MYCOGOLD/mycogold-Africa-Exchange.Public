#include "mycogold/order_book.hpp"

#include <algorithm>
#include <array>
#include <charconv>
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <exception>
#include <iostream>
#include <random>
#include <stdexcept>
#include <string>
#include <string_view>
#include <system_error>
#include <vector>

using mycogold::matching::Order;
using mycogold::matching::Side;
using mycogold::matching::match_orders;

namespace {

constexpr std::size_t kDefaultPairs = 50'000;
constexpr std::size_t kMaximumPairs = 500'000;
constexpr std::size_t kMeasuredRuns = 7;

std::size_t parse_pair_count(int argc, char** argv) {
  if (argc > 2) {
    throw std::invalid_argument("Usage: order_book_benchmark [pair-count]");
  }
  if (argc == 1) return kDefaultPairs;

  std::size_t value = 0;
  const std::string_view argument(argv[1]);
  const auto [end, error] = std::from_chars(
      argument.data(), argument.data() + argument.size(), value);
  if (error != std::errc{} || end != argument.data() + argument.size() ||
      value == 0 || value > kMaximumPairs) {
    throw std::invalid_argument("Pair count must be an integer between 1 and 500000");
  }
  return value;
}

std::vector<Order> make_orders(std::size_t pairs) {
  std::vector<Order> orders;
  orders.reserve(pairs * 2);
  for (std::size_t i = 0; i < pairs; ++i) {
    const auto sequence = static_cast<std::uint64_t>(i * 2 + 1);
    const auto offset = static_cast<std::int64_t>(i % 100);
    orders.push_back({
        "buy-" + std::to_string(i), "buyer-" + std::to_string(i),
        "TOMATO", "GRADE_1", "NAIROBI", Side::buy,
        12'000 + offset, 1'000, sequence, 9'999'999'999, 1
    });
    orders.push_back({
        "sell-" + std::to_string(i), "seller-" + std::to_string(i),
        "TOMATO", "GRADE_1", "NAIROBI", Side::sell,
        10'000 + offset, 1'000, sequence + 1, 9'999'999'999, 1
    });
  }

  // Avoid benchmarking only the already-sorted best case.
  std::mt19937_64 generator(0x4d59434f474f4c44ULL);
  std::shuffle(orders.begin(), orders.end(), generator);
  return orders;
}

}  // namespace

int main(int argc, char** argv) {
  try {
    const std::size_t pairs = parse_pair_count(argc, argv);
    const auto orders = make_orders(pairs);

    // Warm the allocator and instruction/data caches; exclude this run.
    const auto warmup = match_orders(orders, 1'000'000);
    if (warmup.fills.size() != pairs) {
      std::cerr << "Warm-up produced an unexpected fill count.\n";
      return EXIT_FAILURE;
    }

    std::array<std::int64_t, kMeasuredRuns> samples{};
    std::size_t measured_fills = 0;
    for (auto& sample : samples) {
      const auto start = std::chrono::steady_clock::now();
      const auto result = match_orders(orders, 1'000'000);
      const auto finish = std::chrono::steady_clock::now();
      sample = std::chrono::duration_cast<std::chrono::nanoseconds>(
          finish - start).count();
      measured_fills = result.fills.size();
      if (measured_fills != pairs) {
        std::cerr << "Benchmark produced an unexpected fill count.\n";
        return EXIT_FAILURE;
      }
    }

    std::sort(samples.begin(), samples.end());
    const double median_ns = static_cast<double>(samples[samples.size() / 2]);
    const double orders_per_second =
        (static_cast<double>(orders.size()) * 1'000'000'000.0) / median_ns;
    const double fills_per_second =
        (static_cast<double>(measured_fills) * 1'000'000'000.0) / median_ns;

    std::cout << "engine=cpp20"
              << " orders=" << orders.size()
              << " fills=" << measured_fills
              << " runs=" << kMeasuredRuns
              << " median_ns=" << static_cast<std::uint64_t>(median_ns)
              << " orders_per_second=" << static_cast<std::uint64_t>(orders_per_second)
              << " fills_per_second=" << static_cast<std::uint64_t>(fills_per_second)
              << '\n';
    return EXIT_SUCCESS;
  } catch (const std::exception& error) {
    std::cerr << "Benchmark error: " << error.what() << '\n';
    return EXIT_FAILURE;
  }
}
