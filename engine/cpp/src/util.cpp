#include "mycogold/util.hpp"
#include <cctype>
#include <stdexcept>
namespace mycogold::core {
bool is_safe_identifier(std::string_view value) noexcept {
  if (value.empty() || value.size() > kMaxIdentifierLength) return false;
  for (const unsigned char c : value) {
    if (!(std::isalnum(c) || c == '_' || c == '-' || c == '.')) return false;
  }
  return true;
}
std::string require_identifier(std::string_view value, const char* field) {
  if (!is_safe_identifier(value)) throw std::invalid_argument(std::string(field) + " is not a safe identifier");
  return std::string(value);
}
bool is_hex_digest(std::string_view value) noexcept {
  if (value.size() != 64) return false;
  for (const unsigned char c : value) if (!std::isxdigit(c)) return false;
  return true;
}
}