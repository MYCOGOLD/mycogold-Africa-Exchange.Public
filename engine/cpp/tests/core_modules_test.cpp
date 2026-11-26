#include "mycogold/db.hpp"
#include "mycogold/net.hpp"
#include "mycogold/optimization.hpp"
#include "mycogold/script.hpp"
#include "mycogold/sha.hpp"
#include "mycogold/util.hpp"
#include "mycogold/worker_discovery.hpp"

#include <cstdlib>
#include <iostream>
#include <stdexcept>
#include <string>
#include <utility>

namespace {
void require(bool condition, const char* message) {
  if (!condition) { std::cerr << "FAIL: " << message << '\n'; std::exit(EXIT_FAILURE); }
}
template <typename Fn> void must_throw(Fn&& fn, const char* message) {
  try { fn(); } catch (const std::exception&) { return; }
  require(false, message);
}
mycogold::matching::Order make_order(
    std::string id, std::string trader, mycogold::matching::Side side,
    std::int64_t price, std::int64_t quantity, std::uint64_t priority) {
  return {std::move(id), std::move(trader), "TOMATO", "GRADE_1", "NAIROBI",
          side, price, quantity, priority, 2'000'000, 1};
}
}

int main() {
  using namespace mycogold;
  require(core::is_safe_identifier("TOMATO_GRADE-1"), "safe identifier accepted");
  require(!core::is_safe_identifier("../orders"), "path traversal identifier rejected");
  require(!core::is_safe_identifier(""), "empty identifier rejected");
  require(!core::is_safe_identifier("TOMAT\xC3\x93"), "non-ASCII identifier rejected");
  require(core::is_hex_digest(std::string(64, 'a')), "lowercase SHA-256 hex accepted");
  require(!core::is_hex_digest(std::string(63, 'a')), "short digest rejected");
  require(core::sha256_hex("") ==
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "SHA-256 matches standard empty-string test vector");

  const protocol::Message message{1, protocol::MessageType::market_snapshot, "{\"market\":\"NAIROBI\"}"};
  const auto frame = protocol::encode(message);
  const auto decoded = protocol::decode(frame);
  require(decoded.version == 1 && decoded.type == message.type &&
          decoded.payload == message.payload, "protocol frame round-trips");
  auto malformed = frame;
  malformed[0] = 'X';
  must_throw([&] { (void)protocol::decode(malformed); }, "invalid protocol magic rejected");
  must_throw([&] {
    (void)protocol::encode({2, protocol::MessageType::health, "x"});
  }, "unsupported protocol version rejected");

  const rules::Policy policy{"freshness_gate", {
      {rules::Metric::quality_remaining, rules::Comparison::greater_or_equal, 0.65},
      {rules::Metric::temperature_c, rules::Comparison::less_or_equal, 8.0}
  }};
  const auto accepted = rules::evaluate(policy, {0.8, 5.0});
  require(accepted.accepted && accepted.failed_predicates.empty(), "declarative rule accepts valid metrics");
  const auto rejected = rules::evaluate(policy, {0.4, 12.0});
  require(!rejected.accepted && rejected.failed_predicates.size() == 2,
          "declarative rule reports all failed predicates");
  must_throw([&] { (void)rules::evaluate(policy, {0.8}); }, "missing metric rejected");

  const workers::Registry registry({
      {"worker-cpp-1", "https://engine.internal/match", "matching"},
      {"worker-ai-1", "https://ai.internal/forecast", "forecasting"}
  });
  require(registry.capable_of("matching").size() == 1, "worker capability discovery works");
  must_throw([] {
    (void)workers::Registry({{"bad-worker", "http://untrusted.local", "matching"}});
  }, "non-TLS worker endpoint rejected");
  must_throw([] {
    (void)workers::Registry({{"empty-host", "https://", "matching"}});
  }, "empty worker host rejected");
  must_throw([] {
    (void)workers::Registry({{"userinfo", "https://worker@evil.internal/match", "matching"}});
  }, "worker endpoint userinfo rejected");

  optimization::QuboProblem qubo{{-1.0, -0.5}, {{0, 1, 2.0}}, 0.0};
  optimization::Options annealing;
  annealing.iterations = 30000;
  annealing.seed = 20261126;
  const auto solution = optimization::solve_simulated_annealing(qubo, annealing);
  const auto repeated_solution = optimization::solve_simulated_annealing(qubo, annealing);
  require(solution.variables == repeated_solution.variables &&
          solution.energy == repeated_solution.energy, "QUBO solve is repeatable for a fixed toolchain and seed");
  require(solution.variables.size() == 2 && solution.energy <= -1.0,
          "QUBO optimizer finds a low-energy binary assignment");
  require(!solution.optimality_guaranteed, "classical heuristic does not claim global optimality");
  must_throw([] {
    optimization::QuboProblem invalid{{1.0, 2.0}, {{0, 1, 1.0}, {1, 0, 2.0}}, 0.0};
    (void)optimization::solve_simulated_annealing(invalid);
  }, "duplicate unordered QUBO pair rejected");

  persistence::Snapshot snapshot{
      "snapshot-001", 1'000'000,
      {
          make_order("buy-1", "buyer-1", matching::Side::buy, 12'000, 2'000, 1),
          make_order("sell-1", "seller-1", matching::Side::sell, 10'000, 1'000, 2)
      }
  };
  persistence::validate_snapshot(snapshot);
  const auto matched = matching::match_orders(snapshot.orders, snapshot.captured_at_epoch_ms);
  require(matched.fills.size() == 1, "test snapshot creates one match");
  persistence::CommitIntent intent{"match-batch-001", snapshot.snapshot_id, matched.fills};
  persistence::validate_commit_intent(snapshot, intent);
  auto stale = intent;
  stale.fills[0].buy_order_version += 1;
  must_throw([&] { persistence::validate_commit_intent(snapshot, stale); },
             "stale database row version rejected");
  auto overfill = intent;
  overfill.fills[0].quantity_grams = 2'001;
  must_throw([&] { persistence::validate_commit_intent(snapshot, overfill); },
             "overfilled match proposal rejected");
  auto wrong_book = intent;
  wrong_book.fills[0].market_code = "NYERI";
  must_throw([&] { persistence::validate_commit_intent(snapshot, wrong_book); },
             "cross-market fill rejected");
  auto off_maker_price = intent;
  off_maker_price.fills[0].execution_price_kes_cents_per_kg = 11'000;
  must_throw([&] { persistence::validate_commit_intent(snapshot, off_maker_price); },
             "non-maker execution price rejected");
  auto wrong_maker = intent;
  wrong_maker.fills[0].maker_priority_sequence = 99;
  must_throw([&] { persistence::validate_commit_intent(snapshot, wrong_maker); },
             "unknown maker priority rejected");

  std::cout << "All native core module tests passed.\n";
  return EXIT_SUCCESS;
}
