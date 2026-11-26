#include "mycogold/util.hpp"

#include <stdexcept>

namespace mycogold::core {

namespace {
bool ascii_alphanumeric(const unsigned char value) noexcept {
  return (value >= 'a' && value <= 'z') ||
         (value >= 'A' && value <= 'Z') ||
         (value >= '0' && value <= '9');
}
}

bool is_safe_identifier(std::string_view value) noexcept {
  if (value.empty() || value.size() > kMaxIdentifierLength) return false;
  for (const unsigned char c : value) {
    if (!(ascii_alphanumeric(c) || c == '_' || c == '-' || c == '.')) return false;
  }
  return true;
}

std::string require_identifier(std::string_view value, const char* field) {
  if (!is_safe_identifier(value)) {
    throw std::invalid_argument(std::string(field) + " is not a safe identifier");
  }
  return std::string(value);
}

bool is_hex_digest(std::string_view value) noexcept {
  if (value.size() != 64) return false;
  for (const unsigned char c : value) {
    const bool hexadecimal = (c >= '0' && c <= '9') ||
        (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
    if (!hexadecimal) return false;
  }
  return true;
}

}