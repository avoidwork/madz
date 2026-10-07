## Why

The `decision` tool is config-gated: it registers only when `agent.decision.baseUrl` is set. But the system prompt never mentions it, so when the tool IS enabled the agent has no guidance on when or how to use it — it may not reach for it at all, or may misuse it. When the tool is disabled, the prompt must not reference it either, since a dangling mention of a non-existent tool is noise and can mislead the model.

## What Changes

- Add a placeholder token (`<!-- DECISION_TOOL_INSTRUCTION -->`) near the top of `prompts/SYSTEM_PROMPT.md` as a standalone, unnumbered block.
- In `loadSystemPrompt()` (`src/memory/prompts.js`), replace the token with a concise instruction block when `agent.decision.baseUrl` is non-empty, or with an empty string when it is empty/unset.
- The instruction is NOT a numbered directive — a numbered entry would leave a gap in the numbered list when the tool is disabled.

## Capabilities

### New Capabilities
- `decision-tool-instruction`: The system prompt conditionally includes an instruction block describing the `decision` tool when it is enabled, and omits it when disabled.

### Modified Capabilities
- `system-prompt`: `loadSystemPrompt` SHALL conditionally inject the decision tool instruction based on `agent.decision.baseUrl`.

## Impact

- `prompts/SYSTEM_PROMPT.md` — add the token and define the instruction text.
- `src/memory/prompts.js` — `loadSystemPrompt()` performs the token replacement.
- `tests/unit/prompts.test.js` — add tests for enabled and disabled states.
- No change to the `decision` tool registration, config schema, or `createDeepAgentsOrchestrator()` caller.

## Non-goals

- No change to the `decision` tool itself, its registration logic in `src/tools/index.js`, or the config schema.
- No change to how other tools are described in the system prompt.
- No change to the sub-agent prompt files.
