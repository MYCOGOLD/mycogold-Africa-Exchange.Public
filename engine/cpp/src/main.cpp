#include "mycogold/db.hpp"
#include "mycogold/net.hpp"
#include "mycogold/optimization.hpp"
#include "mycogold/script.hpp"
#include "mycogold/sha.hpp"
#include "mycogold/util.hpp"
#include "mycogold/worker_discovery.hpp"

#include <exception>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

void self_check() {
  using namespace mycogold;
  if (core::sha256_hex("mycogold-engine-self-check").size() != 64) {
    throw std::runtime_error("SHA-256 self-check failed");
  }

  const protocol::Message health{1, protocol::MessageType::health, "ok"};
  const auto decoded = protocol::decode(protocol::encode(health));
  if (decoded.payload != "ok" || decoded.version != 1) {
    throw std::runtime_error("Protocol round-trip self-check failed");
  }

  const rules::Policy policy{"self_check", {
      {rules::Metric::quality_remaining, rules::Comparison::greater_or_equal, 0.5}
  }};
  if (!rules::evaluate(policy, {0.9}).accepted) {
    throw std::runtime_error("Policy evaluation self-check failed");
  }

  optimization::QuboProblem problem{{-1.0, -0.5}, {{0, 1, 2.0}}, 0.0};
  optimization::Options options;
  options.iterations = 10'000;
  options.seed = 20261126;
  const auto solution = optimization::solve_simulated_annealing(problem, options);
  if (solution.variables.size() != 2 || solution.optimality_guaranteed) {
    throw std::runtime_error("QUBO solver self-check failed");
  }

  const workers::Registry registry({
      {"local-matcher", "https://matcher.internal/v1", "matching"}
  });
  if (registry.capable_of("matching").size() != 1) {
    throw std::runtime_error("Worker registry self-check failed");
  }

  std::cout << "engine=self-check status=ok protocol=v1 crypto=sha256 "
               "rules=ok optimization=classical-simulated-annealing workers=ok\n";
}

}  // namespace

int main(int argc, char** argv) {
  if (argc != 2) {
    std::cerr << "Usage: mycogold-engine --version | --capabilities | --self-check\n";
    return 64;
  }
  const std::string command(argv[1]);
  if (command == "--version") {
    std::cout << "MycoGold Native Engine 1.1.0 (C++20)\n";
    return 0;
  }
  if (command == "--capabilities") {
    std::cout << "matching,market-index,freshness,policy-evaluation,sha256,"
                 "versioned-protocol,qubo-classical,worker-registry,c-abi\n";
    return 0;
  }
  if (command == "--self-check") {
    try {
      self_check();
      return 0;
    } catch (const std::exception& error) {
      std::cerr << "engine=self-check status=failed reason=" << error.what() << '\n';
      return 2;
    }
  }
  std::cerr << "Unknown command: " << command << '\n';
  return 64;
}