/**
 * Server-side Anthropic Messages API adapter.
 *
 * Keep API keys in server-only environment variables. This module intentionally
 * has no SDK dependency: it uses the platform fetch API and can be tested with
 * an injected fetch implementation. Mock mode is explicit, never an automatic
 * production fallback.
 */

export type AnthropicRole = "user" | "assistant";
export interface AnthropicMessage {
  role: AnthropicRole;
  content: string | Array<Record<string, unknown>>;
}
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}
export interface AnthropicTextBlock {
  type: "text";
  text: string;
}
export interface AnthropicToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}
export type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | Record<string, unknown>;
export interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: AnthropicContentBlock[];
  stop_reason: string | null;
  usage?: { input_tokens: number; output_tokens: number };
}
export interface AnthropicConfig {
  apiKey?: string;
  model?: string;
  mode?: "anthropic" | "mock";
  maxRetries?: number;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}
export interface GenerateInput {
  system: string;
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  maxTokens?: number;
  cacheSystemPrompt?: boolean;
}

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 8_000);
  }
  return Math.min(250 * 2 ** attempt, 4_000);
}

export class AnthropicClient {
  private readonly config: Required<Pick<AnthropicConfig, "model" | "mode" | "maxRetries" | "timeoutMs">> &
    Pick<AnthropicConfig, "apiKey"> & { fetcher: typeof fetch };

  constructor(config: AnthropicConfig = {}) {
    const requestedRetries = Number.isFinite(config.maxRetries) ? Math.trunc(config.maxRetries as number) : 2;
    const requestedTimeout = Number.isFinite(config.timeoutMs) ? Math.trunc(config.timeoutMs as number) : 20_000;
    this.config = {
      apiKey: config.apiKey,
      model: config.model?.trim() || DEFAULT_MODEL,
      mode: config.mode ?? "anthropic",
      maxRetries: Math.max(0, Math.min(requestedRetries, 5)),
      timeoutMs: Math.max(1_000, requestedTimeout),
      fetcher: config.fetcher ?? fetch,
    };
    if (this.config.mode === "anthropic" && !this.config.apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required when AI mode is anthropic");
    }
  }

  async generate(input: GenerateInput): Promise<AnthropicResponse> {
    if (!input.system.trim() || input.messages.length === 0) {
      throw new Error("A non-empty system prompt and at least one message are required");
    }
    if (this.config.mode === "mock") {
      const last = input.messages[input.messages.length - 1];
      return {
        id: "mock-message",
        type: "message",
        role: "assistant",
        model: "mycogold-local-mock",
        content: [{ type: "text", text: this.mockReply(last.content) }],
        stop_reason: "end_turn",
        usage: { input_tokens: 0, output_tokens: 0 },
      };
    }

    const system: Array<Record<string, unknown>> = [{
      type: "text",
      text: input.system,
      ...(input.cacheSystemPrompt ? { cache_control: { type: "ephemeral" } } : {}),
    }];
    const requestedMaxTokens = input.maxTokens ?? 1_024;
    if (!Number.isSafeInteger(requestedMaxTokens) || requestedMaxTokens < 1) {
      throw new Error("maxTokens must be a positive safe integer");
    }
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: Math.min(requestedMaxTokens, 8_192),
      system,
      messages: input.messages,
    };
    if (input.tools?.length) body.tools = input.tools;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
      let response: Response;
      try {
        response = await this.config.fetcher(API_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.config.apiKey as string,
            "anthropic-version": API_VERSION,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error) {
        clearTimeout(timeout);
        if (attempt < this.config.maxRetries && !(error instanceof Error && error.name === "AbortError")) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay(new Response(null), attempt)));
          continue;
        }
        throw error;
      }

      // Keep the abort timer active until the response body has been consumed.
      // Fetch resolves when headers arrive; clearing here would leave a stalled
      // JSON/error body unbounded by timeoutMs.
      try {
        if (response.ok) return await response.json() as AnthropicResponse;
        const retryable = response.status === 429 || response.status === 500 ||
          response.status === 502 || response.status === 503 || response.status === 529;
        if (retryable && attempt < this.config.maxRetries) {
          const delay = retryDelay(response, attempt);
          clearTimeout(timeout);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        const detail = (await response.text()).slice(0, 500);
        throw new Error("Anthropic API request failed (" + response.status + "): " + detail);
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error("Anthropic API retry budget exhausted");
  }

  /**
   * Execute Claude tool-use turns against an explicit allowlist of server-side
   * handlers. Tool names absent from the registry are never executed.
   */
  async runWithTools(
    input: GenerateInput,
    handlers: Record<string, (args: Record<string, unknown>) => Promise<unknown> | unknown>,
    maxToolRounds = 4,
  ): Promise<AnthropicResponse> {
    const messages: AnthropicMessage[] = input.messages.slice();
    const requestedRounds = Number.isFinite(maxToolRounds) ? Math.floor(maxToolRounds) : 4;
    const rounds = Math.max(0, Math.min(requestedRounds, 8));
    for (let round = 0; round <= rounds; round += 1) {
      const response = await this.generate({ ...input, messages });
      const calls = response.content.filter((block): block is AnthropicToolUseBlock => {
        if (!isRecord(block)) return false;
        return block.type === "tool_use" &&
          typeof block.id === "string" && block.id.length > 0 &&
          typeof block.name === "string" && block.name.length > 0 &&
          isRecord(block.input);
      });
      if (response.stop_reason !== "tool_use" || calls.length === 0) return response;
      if (round === rounds) throw new Error("Anthropic tool-use round limit reached");

      messages.push({ role: "assistant", content: response.content as Array<Record<string, unknown>> });
      const results: Array<Record<string, unknown>> = [];
      for (const call of calls) {
        const handler = Object.prototype.hasOwnProperty.call(handlers, call.name)
          ? handlers[call.name]
          : undefined;
        if (typeof handler !== "function") {
          results.push({ type: "tool_result", tool_use_id: call.id, is_error: true,
            content: `Tool '${call.name}' is not permitted by this service.` });
          continue;
        }
        try {
          const result = await handler(call.input);
          const serialized = JSON.stringify(result) ?? String(result);
          results.push({ type: "tool_result", tool_use_id: call.id,
            content: serialized.slice(0, 20_000) });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Tool execution failed";
          results.push({ type: "tool_result", tool_use_id: call.id, is_error: true,
            content: message.slice(0, 1_000) });
        }
      }
      messages.push({ role: "user", content: results });
    }
    throw new Error("Anthropic tool-use loop terminated unexpectedly");
  }

  private mockReply(content: AnthropicMessage["content"]): string {
    const prompt = typeof content === "string"
      ? content
      : content
          .filter((block) => block.type === "text" && typeof block.text === "string")
          .map((block) => String(block.text))
          .join(" ");
    const normalized = prompt.toLowerCase();
    if (normalized.includes("mushroom")) {
      return "LOCAL MOCK: review harvest time, substrate batch, temperature history, grade and buyer demand before recommending a mushroom handling action.";
    }
    if (normalized.includes("price") || normalized.includes("market")) {
      return "LOCAL MOCK: compare recent verified trades by market, grade and unit; label sparse observations as indicative rather than verified live prices.";
    }
    return "LOCAL MOCK: TUSK is running without external AI. Provide verified produce, location, quantity and timing data for a grounded recommendation.";
  }
}

/** Construct explicitly from server environment; never expose this result to a client component. */
export function createAnthropicClient(env: Record<string, string | undefined> = process.env): AnthropicClient {
  const mode = env.MYCOGOLD_AI_MODE === "mock" ? "mock" : "anthropic";
  return new AnthropicClient({
    mode,
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.ANTHROPIC_MODEL,
  });
}
