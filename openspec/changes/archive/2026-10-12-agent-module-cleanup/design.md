## Context

The agent module (`src/agent/`) is the orchestration layer of the madz harness. It contains `agentDefinitions.js` (data-driven agent config + prompt loading), `agentRegistry.js` (a registry class with no production consumer), and `deepAgents.js` (the DeepAgents orchestrator factory). Issue #1377 identifies five cleanup targets. All are internal refactors that should preserve observable behavior.

Current state:
- `agentRegistry.js` exports `AgentRegistry`, referenced only by `tests/unit/agentRegistry.test.js`. No `src/` file imports it.
- `agentDefinitions.js` runs a top-level `await Promise.all(...)` that reads all 12 prompt files at import time. `getAllAgents()` is synchronous and called synchronously in `deepAgents.js` and in tests.
- `deepAgents.js` has `getAgentClassifications(agentName)` returning `[agentName]` — a trivial identity wrapper.
- `deepAgents.js` `createDeepAgentsOrchestrator` mutates the shared config singleton (`config.summarization.trigger`, `config.providers[providerName].contextWindow`) returned by `loadConfig()`.
- `deepAgents.js` `createSubagentDefinitions` does `allTools.find((t) => t.name === name)` per tool name — O(n*m).

## Goals / Non-Goals

**Goals:**
- Remove dead code (`AgentRegistry` class + its test).
- Defer eager prompt loading to first `getAllAgents()` call.
- Remove the trivial identity wrapper `getAgentClassifications`.
- Stop mutating the shared config singleton; propagate derived values explicitly.
- Replace O(n*m) tool lookup with a Map-based O(1) lookup.

**Non-Goals:**
- No new features or abstractions.
- No changes to prompt file contents or `AGENT_CONFIGS`.
- No changes to tool classification logic in `getToolsForAgentTypes`.
- No change to the summarization trigger derivation formula (80% of context length).

## Decisions

### 1. Delete `AgentRegistry` and its test
The class has no production consumer (YAGNI). Grep confirms only `tests/unit/agentRegistry.test.js` references it. Delete both `src/agent/agentRegistry.js` and `tests/unit/agentRegistry.test.js`. The `agent-registry` spec capability is deleted accordingly: `openspec/specs/agent-registry` and the change's delta spec are removed entirely (OpenSpec cannot write an empty spec, so the spec is deleted rather than updated to zero requirements).

### 2. Lazy prompt loading with an asynchronous `getAllAgents()`
The public API `getAllAgents()` is now async. It defers the prompt-file I/O to the first call and caches the resolved array, so subsequent calls return the cached result without re-reading the files. The warn-and-continue behavior on a missing prompt file is preserved.

**Why async:** AGENTS.md §1.1 forbids blocking operations (e.g. `readFileSync`) inside async functions. The original eager top-level `await Promise.all` was async but ran at import time; the lazy-loading fix initially used `readFileSync` to keep `getAllAgents()` synchronous, which reintroduced a blocking I/O violation. The correct fix is to keep the I/O async and propagate `async` through `createSubagentDefinitions` and `createDeepAgentsOrchestrator`.

**Alternative considered:** Keeping `getAllAgents()` synchronous via `readFileSync`. Rejected because it violates AGENTS.md §1.1 (blocking I/O in async contexts) and the audit's core principle. The blast radius is contained to `createSubagentDefinitions` and its single call site in `createDeepAgentsOrchestrator`, both of which are already async.

### 3. Inline the identity wrapper
`getAgentClassifications(agentName)` returns `[agentName]`. Inline `[agentDef.name]` at the single call site in `createSubagentDefinitions` and delete the function. This is a KISS cleanup with no behavior change.

### 4. Stop mutating the shared config singleton
The mutation existed so the TUI `/settings` view and status bar reflect the live derived trigger/context window. Instead of mutating the shared `loadConfig()` object, we propagate the derived values explicitly:
- Pass the derived trigger directly into `createSummarizationMiddlewareFromConfig` (via a locally-constructed config object or an explicit argument).
- Expose the derived context window on the returned orchestrator object (e.g., `result.contextWindow`) so consumers can read it without a hidden side effect.

**Alternative considered:** Keep the mutation but document it. Rejected because it's a hidden side effect in a factory and contaminates the shared config across calls.

### 5. Map-based tool lookup
Build a `Map` keyed by tool name once at the top of `createSubagentDefinitions`, then look up each filtered tool name in O(1). Preserve the `.filter(Boolean)` to drop missing tools.

## Risks / Trade-offs

- **[Lazy loading changes import-time behavior]** → The first `getAllAgents()` call now performs the I/O. Since `getAllAgents()` is called at the top of `createSubagentDefinitions` (which runs during orchestrator creation) and at test module load, the I/O is still triggered before any agent runs. No functional regression; only the timing of the first load shifts.
- **[Removing config mutation may break TUI consumers]** → The TUI `/settings` view and status bar read `config.summarization.trigger` and `config.providers[providerName].contextWindow`. We must verify these consumers and update them to read the explicitly-propagated values. This is the highest-risk change; tests must confirm the derived values still reach the TUI.
- **[Deleting `AgentRegistry` removes a public export]** → No production consumer exists, so this is safe. The `agent-registry` spec is deleted to keep specs in sync.

## Migration Plan

No deployment migration. This is a code-level refactor. Rollback is a revert of the feature branch.

## Open Questions

- How does the TUI consume `config.summarization.trigger` and `config.providers[providerName].contextWindow`? This must be traced before removing the mutation to ensure the derived values still reach the status bar and `/settings` view.
