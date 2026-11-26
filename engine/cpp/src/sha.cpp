#include "mycogold/sha.hpp"
#include <array>
#include <memory>
#include <stdexcept>
#include <openssl/evp.h>
namespace mycogold::core {
std::string sha256_hex(std::span<const unsigned char> bytes) {
  std::array<unsigned char, EVP_MAX_MD_SIZE> digest{};
  unsigned int digest_size = 0;
  using Context = std::unique_ptr<EVP_MD_CTX, decltype(&EVP_MD_CTX_free)>;
  Context context(EVP_MD_CTX_new(), EVP_MD_CTX_free);
  if (!context || EVP_DigestInit_ex(context.get(), EVP_sha256(), nullptr) != 1 ||
      (!bytes.empty() && EVP_DigestUpdate(context.get(), bytes.data(), bytes.size()) != 1) ||
      EVP_DigestFinal_ex(context.get(), digest.data(), &digest_size) != 1 ||
      digest_size != 32) {
    throw std::runtime_error("SHA-256 operation failed");
  }
  constexpr char hex[] = "0123456789abcdef";
  std::string output;
  output.resize(64);
  for (std::size_t i = 0; i < 32; ++i) {
    output[i * 2] = hex[digest[i] >> 4];
    output[i * 2 + 1] = hex[digest[i] & 0x0f];
  }
  return output;
}
std::string sha256_hex(std::string_view text) {
  return sha256_hex(std::span(reinterpret_cast<const unsigned char*>(text.data()), text.size()));
}
}