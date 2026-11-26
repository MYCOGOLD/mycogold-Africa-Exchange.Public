#pragma once
#include <span>
#include <string>
#include <string_view>
namespace mycogold::core {
// SHA-256 for content fingerprints and integrity checks; never an identity,
// signature, authorization token, or proof-of-work mechanism.
std::string sha256_hex(std::span<const unsigned char> bytes);
std::string sha256_hex(std::string_view text);
}