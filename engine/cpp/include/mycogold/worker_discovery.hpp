#pragma once
#include <string>
#include <vector>
namespace mycogold::workers {
struct Worker { std::string worker_id; std::string endpoint; std::string capability; };
class Registry {
 public:
  explicit Registry(std::vector<Worker> trusted_workers);
  const std::vector<Worker>& workers() const noexcept { return workers_; }
  std::vector<Worker> capable_of(const std::string& capability) const;
 private: std::vector<Worker> workers_;
};
}