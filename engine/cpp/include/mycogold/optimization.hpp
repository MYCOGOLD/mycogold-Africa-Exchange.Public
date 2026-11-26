#pragma once
#include <cstddef>
#include <cstdint>
#include <vector>
namespace mycogold::optimization {
struct QuadraticTerm { std::size_t i; std::size_t j; double coefficient; };
struct QuboProblem { std::vector<double> linear; std::vector<QuadraticTerm> quadratic; double offset{0.0}; };
struct Options { std::size_t iterations{20000}; double initial_temperature{10.0}; double final_temperature{0.01}; std::uint64_t seed{42}; };
struct Result { std::vector<std::uint8_t> variables; double energy{0.0}; std::size_t iterations{0}; std::uint64_t seed{0}; bool optimality_guaranteed{false}; };
Result solve_simulated_annealing(const QuboProblem& problem, const Options& options = {});
}