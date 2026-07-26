## Why

The project currently has only two filesystem backends (coreBackend for the project root, contextBackend for memory/context/). To enable proper filesystem routing and sandboxing for additional directories — enabling subagents to have controlled access to specific directory scopes — we need dedicated backends for src/, prompts/, tmp/, and a new workspace/ directory.

## What Changes

- Create `src/agent/backends/srcBackend.js` — sandboxed to src/ directory
- Create `src/agent/backends/promptsBackend.js` — sandboxed to prompts/ directory
- Create `src/agent/backends/tmpBackend.js` — sandboxed to tmp/ directory
- Create `src/agent/backends/workspaceBackend.js` — sandboxed to workspace/ directory
- Wire all four new backends into the CompositeBackend in `src/agent/deepAgents.js` with proper route paths

Each backend follows the existing pattern: instantiate a FilesystemBackend from deepagents with `virtualMode: true` and a rootDir pointing to the specific directory.

## Capabilities

### New Capabilities
- `filesystem-backends`: Dedicated sandboxed filesystem backends for src/, prompts/, tmp/, and workspace/ directories with routing in CompositeBackend

### Modified Capabilities
<!-- No existing spec-level requirements are changing — this is new infrastructure. -->

## Impact

- **New files**: `src/agent/backends/srcBackend.js`, `src/agent/backends/promptsBackend.js`, `src/agent/backends/tmpBackend.js`, `src/agent/backends/workspaceBackend.js`
- **Modified**: `src/agent/deepAgents.js` — import new backends and wire into CompositeBackend
- **Tests**: New tests for each backend module
