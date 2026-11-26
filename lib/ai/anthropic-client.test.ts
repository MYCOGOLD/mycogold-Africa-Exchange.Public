import test from "node:test";
import assert from "node:assert/strict";
import { AnthropicClient } from "./anthropic-client";

const input = {
  system: "You are TUSK, the MycoGold agriculture intelligence assistant.",
  messages: [{ role: "user" as const, content: "Assess mushroom freshness." }],
};

test("mock mode works offline without an API key", async () => {
  const client = new AnthropicClient({ mode: "mock" });
  const result = await client.generate(input);
  assert.equal(result.model, "mycogold-local-mock");
  assert.match((result.content[0] as { text: string }).text, /LOCAL MOCK/);
});

test("Anthropic mode requires a server API key", () => {
  assert.throws(() => new AnthropicClient({ mode: "anthropic" }), /ANTHROPIC_API_KEY/);
});

test("sends structured tool definitions and ephemeral system prompt cache hint", async () => {
  let captured: RequestInit | undefined;
  const client = new AnthropicClient({
    apiKey: "test-key",
    fetcher: async (_url, init) => {
      captured = init;
      return new Response(JSON.stringify({
        id: "msg_test", type: "message", role: "assistant",
        model: "claude-test", content: [{ type: "text", text: "Review harvest records." }],
        stop_reason: "end_turn",
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  await client.generate({
    ...input,
    cacheSystemPrompt: true,
    tools: [{
      name: "get_market_prices",
      description: "Retrieve verified market prices.",
      input_schema: { type: "object", properties: { market: { type: "string" } }, required: ["market"] },
    }],
  });
  assert.ok(captured);
  const headers = captured.headers as Record<string, string>;
  assert.equal(headers["x-api-key"], "test-key");
  const body = JSON.parse(String(captured.body));
  assert.deepEqual(body.system[0].cache_control, { type: "ephemeral" });
  assert.equal(body.tools[0].name, "get_market_prices");
});

test("retries rate-limited responses and then succeeds", async () => {
  let calls = 0;
  const client = new AnthropicClient({
    apiKey: "test-key",
    maxRetries: 1,
    fetcher: async () => {
      calls += 1;
      if (calls === 1) return new Response("rate limited", {
        status: 429, headers: { "retry-after": "0" },
      });
      return new Response(JSON.stringify({
        id: "msg_ok", type: "message", role: "assistant",
        model: "claude-test", content: [{ type: "text", text: "OK" }],
        stop_reason: "end_turn",
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const result = await client.generate(input);
  assert.equal(calls, 2);
  assert.equal(result.id, "msg_ok");
});

test("does not retry permanent client errors", async () => {
  let calls = 0;
  const client = new AnthropicClient({
    apiKey: "test-key",
    maxRetries: 3,
    fetcher: async () => {
      calls += 1;
      return new Response("invalid request", { status: 400 });
    },
  });
  await assert.rejects(client.generate(input), /\(400\)/);
  assert.equal(calls, 1);
});
