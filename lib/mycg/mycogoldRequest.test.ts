import assert from "node:assert/strict";
import {
  mycogoldIdempotencyKey, mycogoldRequest, MycogoldTimeoutError,
  mycogoldOnce, mycogoldIdleWatcher,
} from "./mycogoldRequest";

async function main() {
  assert.notEqual(mycogoldIdempotencyKey(), mycogoldIdempotencyKey());

  let header: string | null = null;
  const result = await mycogoldRequest("/test", {
    idempotencyKey: "test-key",
    fetchImpl: async (_url, init) => {
      header = new Headers(init?.headers).get("X-Idempotency-Key");
      return { ok: true, text: async () => '{"ok":true}' } as Response;
    },
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(header, "test-key");

  await assert.rejects(mycogoldRequest("/timeout", {
    timeoutMs: 50, retries: 1,
    fetchImpl: async () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); },
  }), MycogoldTimeoutError);

  let calls = 0;
  const once = mycogoldOnce(async () => { calls++; return "done"; });
  assert.deepEqual(await Promise.all([once(), once()]), ["done", "done"]);
  assert.equal(calls, 1);

  let fired = false;
  await new Promise<void>(resolve => {
    let watcher: ReturnType<typeof mycogoldIdleWatcher> | undefined;
    watcher = mycogoldIdleWatcher(() => { fired = true; watcher?.stop(); resolve(); }, 30);
  });
  assert.equal(fired, true);
}

main().then(() => console.log("PASS 5/5"), error => {
  console.error(error);
  process.exitCode = 1;
});