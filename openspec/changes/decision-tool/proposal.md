## Why

The harness currently has no way to make a deterministic, structured decision (pick one of N options, answer true/false, or score against a rubric) without invoking a full chat model. Decision models like Together AI's `tev1` are purpose-built for this — they take a `state` (the text to judge) plus a set of `questions`, and return structured answers with probabilities. Running it locally via Ollama keeps the data private and the cost near zero, which fits the project's local-first principle.

## What Changes

- **New `decision` tool** — a thin wrapper around Ollama's `/v1/systemone` endpoint that returns structured `answers` from a single request
- **Config-gated registration** — the tool is registered only when `agent.decision.baseUrl` is set; an unconfigured install is unaffected
- **Tool registration** — add `decision` to `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, and the `TOOLS` map in `src/tools/index.js`
- **Config schema** — add a `DecisionSchema` to `AgentSchema` so zod does not strip `agent.decision`
- **Unit tests** — cover `choice`, `noul`, and `score` question types plus the config-gating path

## Capabilities

### New Capabilities
- `decision-tool`: Provides agents with a `decision` tool that wraps Ollama's `/v1/systemone` endpoint for fast, structured classification — routing, policy checks, and rubric scoring — using a local decision model such as `tev1:4b`. The tool is config-gated: it is only registered when `agent.decision.baseUrl` is present.

### Modified Capabilities
- *(none — no existing specs change)*

## Impact

- **New file**: `src/tools/decision/index.js`
- **Modified file**: `src/tools/index.js` (tool registration)
- **Modified file**: `src/config/schemas/agent.js` (DecisionSchema)
- **Modified file**: `config.yaml` (add `agent.decision` block with empty `baseUrl`)
- **New test file**: `tests/unit/tools/decision.test.js`
- **No new npm dependencies** — uses existing `@langchain/core/tools`, `zod`, and global `fetch`
- **No breaking changes** — purely additive; the tool is config-gated so an unconfigured install is unaffected

## Non-goals

- No new npm dependencies
- No integration test (unit tests mock `fetch`)
- No changes to `deepAgents.js` logic beyond what classification routing already provides
- No changes to the agentic loop
