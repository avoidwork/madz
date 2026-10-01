## Context

The harness uses DeepAgents for orchestration and routes tasks to specialized sub-agents. Tools are registered in `src/tools/index.js` with a permission-tier and factory pattern. The `calendar` tool (`src/tools/calendar/index.js`) demonstrates the reference pattern for a config-gated tool: `calendarImpl(input, options)` reads `options.config`, and the tool is exported via `tool(calendarImpl, { name, description, schema })`.

The `buildToolConfig()` switch already has config-gating patterns to mirror: `generateImage` registers only when `runtimeOptions.falApiKey` is set, and `textToSpeech` registers only when `runtimeOptions.openaiApiKey` is set. The `decision` tool should mirror this — register only when `runtimeOptions.decisionConfig?.baseUrl` is truthy.

The `agent.deepAgents` block in `config.yaml` is currently inert — `AgentSchema` does not include it, so zod strips it on load, and nothing in `src/` reads it (temperature actually comes from the top-level `subAgentsTemperature` map). Adding `decision` to the schema is safe and does not disturb this.

## Goals / Non-Goals

**Goals:**
- Create a `decision` tool that calls Ollama's `/v1/systemone` endpoint and returns structured `answers`
- Register the tool in the tool index with `network:outbound` permission, config-gated on `agent.decision.baseUrl`
- Make the tool available to the orchestrator and the `coding` and `research` subagents
- Add a `DecisionSchema` to `AgentSchema` so zod does not strip `agent.decision`
- Provide unit tests covering `choice`, `noul`, and `score` question types plus the config-gating path

**Non-Goals:**
- No new npm dependencies
- No integration test (unit tests mock `fetch`)
- No changes to `deepAgents.js` logic beyond what classification routing already provides
- No changes to the agentic loop

## Decisions

1. **Place tool in `src/tools/decision/index.js`** — follows the one-directory-per-tool convention in `src/tools/`. The impl reads config from `options.decisionConfig`, consistent with how `calendar` reads `options.config`.

2. **Use `@langchain/core/tools` `tool()` wrapper with a permissive Zod schema** — the `questions` object is dynamic (named questions, each with a different `type`). Validate only that `state` and `questions` are present; pass the rest through to Ollama. `state` is a string or JSON object/array; `questions` is a record of `{ type, instructions, criteria? }`.

3. **Permission: `network:outbound` only** — the tool makes an outbound HTTP call to Ollama. No filesystem access needed.

4. **Config-gating on `baseUrl`** — `baseUrl` is the activation switch. Empty string means the tool is not registered. This mirrors `generateImage`/`textToSpeech`. The `case "decision"` in `buildToolConfig()` registers only when `hasAllPerms && runtimeOptions.decisionConfig?.baseUrl`.

5. **Classifications: `orchestrator`, `coding`, `research`** — the tool is registered for the orchestrator and the `coding` and `research` subagents. Adding `decision` to `TOOL_CLASSIFICATIONS` for these agent types automatically surfaces it in those subagents' descriptions via `getToolsForAgentTypes()`.

6. **`DecisionSchema` defaults** — `baseUrl` string default `""`, `model` string default `"tev1:4b"`, `temperature` number default `0`. The `agent.decision` block in `config.yaml` is added with an empty `baseUrl` so an unconfigured install is unaffected.

## Risks / Trade-offs

- **Config caching** → `loadConfig()` caches after first call. The `decision` tool reads `options.decisionConfig` which is populated from `config.agent.decision` in `buildToolConfig()`. No additional caching concerns.
- **Sensitive data exposure** → No API key required; Ollama ignores the TypeSafe SDK key. The connection is a local `baseUrl` only, stored in `config.yaml`. The outbound `baseUrl` should be validated against the sandbox URL allowlist (reject `file://`, `gopher://`, `dict://`).
- **Request timeout** → External HTTP call must have a timeout. Use an `AbortController` with a default timeout, consistent with `generateImage`/`textToSpeech`.
- **Unexpected response shape** → The model may return an unexpected response. Handle non-OK responses and missing `answers` gracefully.
- **Input validation** → Validate `state` and `questions` against a Zod schema before sending. Enforce the 64 KiB request-body limit and the 2–24 option range for `choice`/`score` questions.
