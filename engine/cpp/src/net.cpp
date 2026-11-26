#include "mycogold/net.hpp"
#include "mycogold/util.hpp"
#include <algorithm>
#include <iterator>
#include <stdexcept>
namespace mycogold::protocol {
namespace {
constexpr unsigned char magic[] = {'M','G','X','1'};
void put_u32(std::vector<unsigned char>& out, std::uint32_t v) {
  out.push_back(static_cast<unsigned char>(v >> 24)); out.push_back(static_cast<unsigned char>(v >> 16));
  out.push_back(static_cast<unsigned char>(v >> 8)); out.push_back(static_cast<unsigned char>(v));
}
std::uint32_t get_u32(const std::vector<unsigned char>& in, std::size_t p) {
  return (static_cast<std::uint32_t>(in[p]) << 24) | (static_cast<std::uint32_t>(in[p+1]) << 16) |
         (static_cast<std::uint32_t>(in[p+2]) << 8) | static_cast<std::uint32_t>(in[p+3]);
}
}
std::vector<unsigned char> encode(const Message& message) {
  if (message.version != 1 || message.payload.size() > mycogold::core::kMaxPayloadBytes ||
      message.type < MessageType::health || message.type > MessageType::optimization_job)
    throw std::invalid_argument("Unsupported message version, type or payload size");
  std::vector<unsigned char> out;
  out.reserve(10 + message.payload.size());
  out.insert(out.end(), std::begin(magic), std::end(magic));
  out.push_back(message.version); out.push_back(static_cast<unsigned char>(message.type));
  put_u32(out, static_cast<std::uint32_t>(message.payload.size()));
  out.insert(out.end(), message.payload.begin(), message.payload.end());
  return out;
}
Message decode(const std::vector<unsigned char>& frame) {
  if (frame.size() < 10 || !std::equal(std::begin(magic), std::end(magic), frame.begin()))
    throw std::invalid_argument("Invalid MycoGold protocol frame");
  const auto version = frame[4];
  const auto type = static_cast<MessageType>(frame[5]);
  const auto length = get_u32(frame, 6);
  if (version != 1 || type < MessageType::health || type > MessageType::optimization_job ||
      length > mycogold::core::kMaxPayloadBytes || frame.size() != 10U + length)
    throw std::invalid_argument("Unsupported or malformed MycoGold protocol frame");
  return {version, type, std::string(frame.begin() + 10, frame.end())};
}
}