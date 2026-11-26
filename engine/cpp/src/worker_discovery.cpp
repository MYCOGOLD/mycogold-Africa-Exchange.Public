#include "mycogold/worker_discovery.hpp"
#include "mycogold/util.hpp"
#include <algorithm>
#include <stdexcept>
#include <unordered_set>
namespace mycogold::workers {
Registry::Registry(std::vector<Worker> trusted_workers) : workers_(std::move(trusted_workers)) {
  if (workers_.size() > 256) throw std::invalid_argument("Worker registry exceeds configured capacity");
  std::unordered_set<std::string> ids;
  for (const auto& worker : workers_) {
    mycogold::core::require_identifier(worker.worker_id, "worker_id");
    mycogold::core::require_identifier(worker.capability, "capability");
    if (!ids.insert(worker.worker_id).second || worker.endpoint.rfind("https://", 0) != 0 ||
        worker.endpoint.size() > 512 || worker.endpoint.find('@') != std::string::npos)
      throw std::invalid_argument("Worker must have a unique ID and trusted HTTPS endpoint");
  }
}
std::vector<Worker> Registry::capable_of(const std::string& capability) const {
  std::vector<Worker> result;
  for (const auto& worker : workers_) if (worker.capability == capability) result.push_back(worker);
  return result;
}
}