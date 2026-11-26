#pragma once
#include <cstdint>
#include <string>
#include <string_view>
#include <vector>
namespace mycogold::protocol {
enum class MessageType : std::uint8_t { health = 1, market_snapshot = 2, match_proposal = 3, optimization_job = 4 };
struct Message { std::uint8_t version; MessageType type; std::string payload; };
// Encodes bounded internal-service frames. Transport, TLS and authentication
// are provided by the service gateway, never by this codec.
std::vector<unsigned char> encode(const Message& message);
Message decode(const std::vector<unsigned char>& frame);
}