## Why

The `src/agent/agents/` directory contains 9 agent definition files that are nearly identical in structure — each repeats the same imports, prompt-loading pattern, and agent object shape. This DRY violation creates a maintainability burden: any change to the agent definition pattern requires editing 9 files. Additionally, the directory name `agents/` inside `agent/` is awkward and confusing. A factory function can reduce each file from ~37 lines to ~5 lines, eliminating ~80% of duplicate code and making future agent additions trivial.

## What Changes

- Create `src/agent/definitions/factory.js` with a `createAgentDefinition(name, promptFile, description)` factory function
- Rename `src/agent/agents/` → `src/agent/definitions/`
- Refactor all 9 agent files to use the factory (reducing each from ~37 lines to ~5 lines)
- Update `src/agent/definitions/index.js` to export from the new location
- Update all import paths referencing `src/agent/agents/` to `src/agent/definitions/`
- No behavioral changes — purely structural refactoring

## Capabilities

### New Capabilities
- `agent-definitions`: Factory pattern for agent definition creation, eliminating boilerplate across agent files

### Modified Capabilities
- None — this is a structural refactoring with no spec-level behavior changes

## Impact

- Affected code: `src/agent/agents/` (9 files + index.js), `src/agent/agentRegistry.js`, `src/agent/deepAgents.js`, any other files importing from `src/agent/agents/`
- No API changes — agent object shape is preserved
- No dependency changes
- Zero behavioral impact

## Non-goals

- Moving `src/agent/backends/` to a separate top-level directory (deferred)
- Refactoring `src/agent/agentRegistry.js` or `src/agent/deepAgents.js` beyond import path updates
- Adding new agent definitions
