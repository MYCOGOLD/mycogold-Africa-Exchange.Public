#pragma once
#include "mycogold/order_book.hpp"
#include <cstdint>
#include <string>
#include <vector>
namespace mycogold::persistence {
struct Snapshot { std::string snapshot_id; std::int64_t captured_at_epoch_ms; std::vector<matching::Order> orders; };
struct CommitIntent { std::string idempotency_key; std::string snapshot_id; std::vector<matching::Fill> fills; };
// Validates a read snapshot and a proposed commit payload before the real
// PostgreSQL adapter begins its transaction. This module performs no SQL.
void validate_snapshot(const Snapshot& snapshot);
void validate_commit_intent(const Snapshot& snapshot, const CommitIntent& intent);
}