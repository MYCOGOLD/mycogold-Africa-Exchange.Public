#include "mycogold/sha.hpp"
#include "mycogold/net.hpp"
#include <iostream>
#include <string>
int main(int argc, char** argv) {
  if (argc == 2 && std::string(argv[1]) == "--version") {
    std::cout << "MycoGold Native Engine 1.0.0 (C++20)\n"; return 0;
  }
  if (argc == 2 && std::string(argv[1]) == "--self-check") {
    const auto digest = mycogold::core::sha256_hex("mycogold-engine-self-check");
    const auto frame = mycogold::protocol::encode({1, mycogold::protocol::MessageType::health, "ok"});
    const auto decoded = mycogold::protocol::decode(frame);
    if (decoded.payload != "ok" || digest.size() != 64) return 2;
    std::cout << "engine=self-check status=ok protocol=v1 crypto=sha256\n"; return 0;
  }
  std::cerr << "Usage: mycogold-engine --version | --self-check\n";
  return 64;
}