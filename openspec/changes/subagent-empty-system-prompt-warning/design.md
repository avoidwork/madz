## Context

`src/agent/agentDefinitions.js` defines 12 subagents via `AGENT_CONFIGS`, each mapping an agent name to a prompt file in `prompts/`. At module load, `createAgentDefinition` reads each prompt file asynchronously via `readFile` and populates `systemPrompt`. The read is wrapped in a `try/catch` that logs failures at `logger.debug` and returns the agent with `systemPrompt: ""`.

Because the default log level is `info`, a missing or unreadable prompt file is invisible in normal operation. The affected subagent runs degraded (empty system prompt) with no operator awareness. This is a robustness/observability defect, not a security issue.

## Goals / Non-Goals

**Goals:**
- Surface a prompt-file load failure at `warn` level so the operator sees it at the default log level.
- Keep the orchestrator functional on a missing prompt file (warn-and-continue, not a hard crash at import).
- Preserve the public API (`getAllAgents`, `createAgentDefinition`) and the 12-agent initialization.
- Add unit + regression tests proving the failure is surfaced (warn log or throw), not silently swallowed.

**Non-Goals:**
- Not changing prompt file contents or agent configuration.
- Not converting the failure into a hard crash at module load.
- Not altering the `system-prompt` capability or the `loadSystemPrompt` path in `src/memory/prompts.js`.
- Not changing the `logger` singleton or its level configuration.

## Decisions

**Decision: Elevate the catch-block log level from `debug` to `warn`.**

Rationale: The issue explicitly asks for a "visible warning (or fail fast)". A `warn` log is visible at the default `info` level (pino emits `warn` and above at `info`), satisfies the requirement without destabilizing module load, and aligns with the project convention "Catch at boundaries, never swallow silently" (openspec config.yaml). Alternatives considered:
- **Fail fast (throw):** Rejected — `createAgentDefinition` is invoked via `Promise.all` over all 12 configs at import time; throwing would crash the orchestrator on a single missing prompt, which is more disruptive than the defect warrants.
- **Keep `debug`:** Rejected — invisible at default level, which is the root cause.

**Decision: Keep the `try/catch` and return the agent with `systemPrompt: ""`.**

Rationale: The agent must still be registered so the orchestrator can route to it; the warning is the signal. The empty `systemPrompt` is the degraded-but-functional state.

**Decision: Test by stubbing `readFile` to reject and asserting a `warn`-level log.**

Rationale: The issue's testing strategy calls for stubbing `readFile` to reject. The test will spy on the `logger.warn` method (or assert the agent is rejected) to prove the failure is surfaced. Because `createAgentDefinition` is not exported, the test exercises the module-load path via `getAllAgents()` after mocking `node:fs/promises`.

## Risks / Trade-offs

- **[Warn-and-continue leaves a degraded agent]** → Mitigation: The `warn` log names the agent and the error message, so the operator can identify and fix the missing prompt file.
- **[Module-load test requires mocking `node:fs/promises`]** → Mitigation: Use `node:test`'s `mock.method` (or `mock.module`) to stub `readFile`; the existing test file already imports `getAllAgents` and runs at module init, so the mock must be installed before the module is imported.
- **[Coverage gate]** → Mitigation: The new tests cover the failure path; the existing happy-path tests cover the success path, so line coverage is maintained.
