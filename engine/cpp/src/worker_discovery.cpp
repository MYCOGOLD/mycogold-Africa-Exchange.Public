#include "mycogold/worker_discovery.hpp"
#include "mycogold/util.hpp"

#include <stdexcept>
#include <unordered_set>
#include <utility>

namespace mycogold::workers {
namespace {

bool valid_https_endpoint(const std::string& endpoint) {
  constexpr std::string_view scheme = "https://";
  if (endpoint.size() <= scheme.size() || endpoint.size() > 512 ||
      endpoint.compare(0, scheme.size(), scheme) != 0) return false;

  const auto authority_start = scheme.size();
  const auto authority_end = endpoint.find_first_of("/?#", authority_start);
  const auto authority = endpoint.substr(
      authority_start,
      authority_end == std::string::npos ? std::string::npos : authority_end - authority_start);
  if (authority.empty() || authority.front() == '.' || authority.back() == '.' ||
      authority.find('@') != std::string::npos || authority.find("..") != std::string::npos) {
    return false;
  }
  for (const unsigned char c : endpoint) {
    if (c <= 0x20 || c == 0x7f || c == '\\') return false;
  }
  return true;
}

}  // namespace

Registry::Registry(std::vector<Worker> trusted_workers)
    : workers_(std::move(trusted_workers)) {
  if (workers_.size() > 256) {
    throw std::invalid_argument("Worker registry exceeds configured capacity");
  }
  std::unordered_set<std::string> ids;
  ids.reserve(workers_.size());
  for (const auto& worker : workers_) {
    mycogold::core::require_identifier(worker.worker_id, "worker_id");
    mycogold::core::require_identifier(worker.capability, "capability");
    if (!ids.insert(worker.worker_id).second || !valid_https_endpoint(worker.endpoint)) {
      throw std::invalid_argument(
          "Worker must have a unique ID and syntactically valid trusted HTTPS endpoint");
    }
  }
}

std::vector<Worker> Registry::capable_of(const std::string& capability) const {
  std::vector<Worker> result;
  for (const auto& worker : workers_) {
    if (worker.capability == capability) result.push_back(worker);
  }
  return result;
}

}