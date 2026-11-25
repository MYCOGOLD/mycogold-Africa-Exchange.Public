#include "mycogold/order_book.hpp"

#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <string>
#include <vector>

using mycogold::matching::Order;
using mycogold::matching::Side;
using mycogold::matching::match_orders;

int main(int argc, char** argv) {
  const std::size_t pairs = argc > 1
      ? static_cast<std::size_t>(std::strtoull(argv[1], nullptr, 10))
      : 50'000;
  if (pairs == 0 || pairs > 500'000) {
    std::cerr << "Pair count must be between 1 and 500000.\n";
    return EXIT_FAILURE;
  }

  std::vector<Order> orders;
  orders.reserve(pairs * 2);
  for (std::size_t i = 0; i < pairs; ++i) {
    const auto sequence = static_cast<std::uint64_t>(i * 2 + 1);
    orders.push_back({
        "buy-" + std::to_string(i), "buyer-" + std::to_string(i),
        "TOMATO", "GRADE_1", "NAIROBI", Side::buy,
        12'000, 1'000, sequence, 9'999'999'999
    });
    orders.push_back({
        "sell-" + std::to_string(i), "seller-" + std::to_string(i),
        "TOMATO", "GRADE_1", "NAIROBI", Side::sell,
        10'000, 1'000, sequence + 1, 9'999'999'999
    });
  }

  const auto start = std::chrono::steady_clock::now();
  const auto result = match_orders(orders, 1'000'000);
  const auto elapsed = std::chrono::duration_cast<std::chrono::microseconds>(
      std::chrono::steady_clock::now() - start
  ).count();

  std::cout << "orders=" << orders.size()
            << " fills=" << result.fills.size()
            << " elapsed_us=" << elapsed << '\n';
  if (result.fills.size() != pairs) {
    std::cerr << "Unexpected fill count; benchmark input did not fully match.\n";
    return EXIT_FAILURE;
  }
  return EXIT_SUCCESS;
}
