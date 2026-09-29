## Why

Subagents can silently run with an empty system prompt when their prompt file fails to load. In `src/agent/agentDefinitions.js`, `createAgentDefinition` wraps the `readFile` call in a `try/catch` that swallows the error and logs at `logger.debug`. Because the default log level is `info`, a missing or unreadable prompt file is invisible in normal operation, and the agent runs degraded without any operator awareness.

## What Changes

- Elevate the prompt-load failure in `createAgentDefinition` from `logger.debug` to `logger.warn`, so a missing or unreadable prompt file produces a visible warning at the default log level.
- Keep the `try/catch` structure so module load does not crash (all 12 agents are initialized via `Promise.all` at import time).
- Preserve the public API (`getAllAgents`, `createAgentDefinition` signature) and the 12-agent initialization.
- Add a unit test that stubs `readFile` to reject and asserts the failure is surfaced (either the agent definition is rejected or a `warn`-level log is emitted).
- Add a regression test verifying a missing prompt file produces a warning at `warn` level (or throws), rather than silently degrading at `debug`.

## Capabilities

### New Capabilities
<!-- None — this change modifies an existing capability. -->

### Modified Capabilities
- `subagent-definitions`: The "Subagent System Prompt" requirement is extended so that a prompt-file load failure is surfaced at `warn` level (or fails fast), rather than being silently swallowed at `debug`. This ensures the operator knows an agent is running without its system prompt.

## Impact

- `src/agent/agentDefinitions.js` — the `createAgentDefinition` catch block changes from `logger.debug` to `logger.warn`.
- `tests/unit/agentDefinitions.test.js` — new unit and regression tests for prompt-load failure handling.
- No change to the public API, agent config, prompt file contents, or unrelated subsystems.

## Non-goals

- Not changing the prompt file contents or agent configuration.
- Not changing the public API surface (`getAllAgents`, `createAgentDefinition`).
- Not converting the failure into a hard crash at module load (warn-and-continue is chosen to keep the orchestrator functional).
- Not altering the `system-prompt` capability or the `loadSystemPrompt` path in `src/memory/prompts.js`.
