#pragma once
#include <cstddef>
#include <string>
#include <string_view>
namespace mycogold::core {
constexpr std::size_t kMaxIdentifierLength = 64;
constexpr std::size_t kMaxPayloadBytes = 1U << 20;
bool is_safe_identifier(std::string_view value) noexcept;
std::string require_identifier(std::string_view value, const char* field);
bool is_hex_digest(std::string_view value) noexcept;
}