# MycoGold AI and optimization adapters

## Anthropic / TUSK service boundary

`lib/ai/anthropic-client.ts` is a server-side adapter for the Anthropic
Messages API. It has no additional SDK dependency and accepts an injected
`fetch` implementation for deterministic tests.

Configuration:

- `MYCOGOLD_AI_MODE=mock`: deterministic local responses, no network or API key.
- `MYCOGOLD_AI_MODE=anthropic`: calls Anthropic using server-only
  `ANTHROPIC_API_KEY`.
- `ANTHROPIC_MODEL`: optional model override.
- Prompt caching is opt-in per request with `cacheSystemPrompt: true`.
- 429 and selected transient 5xx/529 responses use bounded retries and
  `Retry-After` when supplied.
- Each request has an abort timeout and bounded output-token setting.
- Tool execution is only possible through `runWithTools`, which accepts an
  explicit handler allowlist. Unknown tool names are returned as tool errors;
  they are never dynamically imported or executed.

Example (server-side route/service only):

```ts
import { createAnthropicClient } from "@/lib/ai/anthropic-client";

const ai = createAnthropicClient();
const response = await ai.generate({
  system: "You are TUSK. Ground claims in supplied verified market data.",
  messages: [{ role: "user", content: "Summarize these verified observations..." }],
  cacheSystemPrompt: true,
  maxTokens: 800,
});
```

Do not pass secrets to client components. Do not put raw personal, financial,
or confidential farmer data into prompts unless the product has a lawful basis,
user notice/consent where required, and a data-minimization policy. Tool handlers
must enforce authorization and validate every argument independently. Model
output is untrusted and must not authorize payments, ledger writes, or inventory
changes.

The mock is a development/test fallback selected explicitly by configuration;
production errors do not silently downgrade to mock answers.

## Quantum-ready optimization boundary

`lib/optimization/qubo.ts` defines a provider-neutral binary quadratic
optimization problem and an executable local simulated-annealing backend.
It is quantum-inspired classical optimization, not a quantum computer and not
a proof of global optimality.

Use cases to model after domain validation include:

- matching produce supply to demand windows;
- allocating limited cold-room capacity;
- grouping deliveries subject to vehicle capacity;
- assigning harvest/packing resources to time slots.

Domain services should translate a constrained business problem into a QUBO,
call the `OptimizationBackend` interface, then independently validate the
returned assignment against hard business constraints. Penalty coefficients
must be calibrated; a low QUBO energy does not automatically imply a feasible
or commercially acceptable plan.

A future QPU adapter can implement `OptimizationBackend` and translate the
same QUBO into a provider SDK such as Qiskit or PennyLane. No QPU SDK, account,
cloud call, or paid quantum service is required by the current local backend.
Keep the classical solver as the reproducible fallback and benchmark reference.

## Local validation

`npm test` includes Anthropic mock/retry/tool-allowlist tests and QUBO solver
tests. `bash scripts/ci-local.sh` runs the complete local application checks.
