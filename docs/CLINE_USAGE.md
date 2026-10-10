# Cline SDK usage and deviations

Notes on how this repo uses the Cline SDK (`@cline/sdk`) and where it differs from the brief.
`@cline/sdk` is **not installed yet**; it is added in Phase 2 (Study Agent, owner: Dev B).

## Plan

- `new Agent({ providerId, modelId, apiKey, tools, toolPolicies, maxIterations })`, then `agent.run(prompt)`.
- Tools are built with `createTool({ name, description, inputSchema: zod, execute })`.
- `agent.subscribe` events (`assistant-text-delta`, `tool-started`, `tool-finished`, `usage-updated`,
  `run-finished`) map onto the SSE stream: text, tool events and the token counter.
- Without an API key the server uses `MockAgent`, which is deterministic.

## Deviations from the brief

1. `maxIterations` is fed from `MAX_TOOL_CALLS`.
2. The SDK is lower level than the brief assumed, so the abstain gate, answer validation and per-call
   timeouts are our own wrappers around it.

## Still to verify before Phase 2

- Exact options for system prompt and abort signal (the Agent API reference page returned 404 when
  checked; use `/llms.txt` and the installed skill).
