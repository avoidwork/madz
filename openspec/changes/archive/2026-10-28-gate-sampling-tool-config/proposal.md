## Why

The `sampling` tool is currently always registered, regardless of configuration. It writes ephemeral memory files to disk on every capture, which is a side effect some deployments may not want. The `decision` tool already supports config-gated registration via `agent.decision.baseUrl`; the `sampling` tool should follow the same pattern so operators can disable it.

## What Changes

- Add an `agent.sampling` boolean config flag (default `true`) that controls whether the `sampling` tool is registered.
- Gate `sampling` tool registration in `buildToolConfig` on the flag, mirroring the `decision` tool's config-gated registration.
- Inject the sampling instruction in the system prompt only when the tool is enabled, via a `SAMPLING_TOOL_INSTRUCTION` token (mirrors the `DECISION_TOOL_INSTRUCTION` token).
- Add `samplingEnabled` to the consumed runtime option keys so the guard test passes.
- Document the flag in `config.yaml`.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `ephemeral-sampling`: Adds a config-gated registration requirement — the `sampling` tool registers only when `agent.sampling` is enabled (default `true`), and its system-prompt instruction is omitted when disabled. Mirrors the `decision` tool's config-gated registration.

## Impact

- `src/config/schemas/agent.js` — add `sampling` boolean to `AgentSchema`.
- `src/tools/index.js` — gate `sampling` registration on `samplingEnabled`; add to `CONSUMED_RUNTIME_OPTION_KEYS`.
- `src/memory/prompts.js` — conditional sampling instruction injection.
- `prompts/SYSTEM_PROMPT.md` — replace static sampling block with `SAMPLING_TOOL_INSTRUCTION` token.
- `config.yaml` — add `agent.sampling` flag.
- `tests/unit/tool_index.test.js`, `tests/unit/prompts.test.js` — gating tests.
- Env var `AGENT_SAMPLING` becomes available via the schema-driven reverse map.

## Non-goals

- No change to the sampling tool's capture behavior, rate limiting, capacity limits, or ephemeral memory TTL.
- No change to the `decision` tool's gating.
- No change to the `telemetry.sampling` config (a separate concern).
