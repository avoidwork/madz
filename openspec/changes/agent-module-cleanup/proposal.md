## Why

The agent module (`src/agent/`) carries dead code, eager I/O, a hidden config-singleton side effect, and an O(n*m) tool lookup. These add startup cost and complexity without benefit. Issue #1377 identifies five cleanup targets that reduce complexity and startup cost without changing observable behavior.

## What Changes

- **Remove dead code**: Delete `src/agent/agentRegistry.js` (the `AgentRegistry` class has no production consumer) and its only test `tests/unit/agentRegistry.test.js`.
- **Defer eager prompt loading**: `src/agent/agentDefinitions.js` currently reads all 12 prompt files at module import time via a top-level `await Promise.all(...)`. Defer this so prompts load lazily on the first `getAllAgents()` call and are cached thereafter.
- **Remove trivial identity wrapper**: Delete `getAgentClassifications(agentName)` in `src/agent/deepAgents.js` (it just returns `[agentName]`) and inline `[agentDef.name]` at its single call site.
- **Stop mutating the shared config singleton**: `createDeepAgentsOrchestrator` in `src/agent/deepAgents.js` mutates `config.summarization.trigger` and `config.providers[providerName].contextWindow` on the shared object returned by `loadConfig()`. Stop mutating the shared singleton and propagate the derived trigger/context-window values explicitly.
- **Replace O(n*m) tool lookup**: `createSubagentDefinitions` in `src/agent/deepAgents.js` does `allTools.find((t) => t.name === name)` per tool name. Build a `Map` keyed by tool name once and look up in O(1).

## Capabilities

### New Capabilities
<!-- None — this is a cleanup/refactor change, not a new capability. -->

### Modified Capabilities
- `agent-registry`: The `AgentRegistry` class is dead code with no production consumer. The `agent-registry` capability (registry pattern for managing subagent definitions) is removed because the class it describes is deleted.

## Impact

- `src/agent/agentRegistry.js` — deleted.
- `tests/unit/agentRegistry.test.js` — deleted.
- `src/agent/agentDefinitions.js` — lazy prompt loading; `getAllAgents()` remains synchronous in signature.
- `src/agent/deepAgents.js` — inline identity wrapper, remove config-singleton mutation, Map-based tool lookup.
- `tests/unit/agentDefinitions.test.js` — may need updates for lazy-load semantics.
- `tests/unit/deepAgents.test.js` — may need updates for config-mutation and tool-lookup changes.

## Non-goals

- No new features or abstractions.
- No changes to prompt file contents or the `AGENT_CONFIGS` data.
- No changes to tool classification logic in `getToolsForAgentTypes`.
- No changes to the summarization trigger derivation formula (80% of context length).
