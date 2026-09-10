## Why

Agents (orchestrator and sub-agents) currently cannot access the project's runtime configuration programmatically. The `loadConfig()` function exists but is only used internally — there is no tool that exposes its output to agents. This forces agents to hardcode config values or rely on incomplete context, which is fragile and error-prone. A `getConfig` tool solves this by providing a single, authoritative source of config data that any agent with the `codeIndex` tool can call.

## What Changes

- **New `getConfig` tool** — a thin wrapper around `loadConfig()` that returns the parsed JSON config to the calling agent
- **Tool registration** — add `getConfig` to `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, and the `TOOLS` map in `src/tools/index.js`
- **Unit tests** — cover success path, error propagation, and schema validation

## Capabilities

### New Capabilities
- `getconfig-tool`: Provides agents with programmatic read-only access to the project's runtime configuration via a `getConfig` tool that calls `loadConfig()` and returns the parsed JSON result

### Modified Capabilities
- *(none — no existing specs change)*

## Impact

- **New file**: `src/tools/codeIndex/getConfig.js`
- **Modified file**: `src/tools/index.js` (tool registration)
- **New test file**: `tests/unit/tools/getConfig.test.js`
- **No new npm dependencies** — uses existing `loadConfig()` from `src/config/loader.js`, `@langchain/core/tools`, and `zod`
- **No breaking changes** — purely additive
