## Why

The `shell` tool conflicts with the deepagents library's shell execution capabilities. The overlapping functionality creates ambiguity in tool selection and potential for unexpected behavior. Removing it simplifies the tool surface and eliminates the duplication.

## What Changes

- Remove the `shell` tool from `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, and `TOOLS` in `src/tools/index.js`
- Remove `shell` references from deep agent tool classifications in `src/agent/deepAgents.js` (debug, testing, security-audit, performance agents lose `shell` to use `executeCode` instead)
- Keep `shell.js` file with `processTool` and `executeShellImpl` internal helpers — the public `shell` tool export is removed but internal functions remain for executeCode shell language support
- Remove shell tool tests from `tests/unit/shell.test.js`, keep process management tests
- Update `tests/unit/tool_index.test.js` to remove shell assertions

## Capabilities

### Removed Capabilities
- `shell`: Public shell command execution tool removed from the agent toolset

### Modified Capabilities
- `debug`: debug agent loses `shell`, uses `executeCode` for code execution
- `testing`: testing agent loses `shell`, uses `executeCode` for code execution
- `security-audit`: security-audit agent loses `shell`, relies on read-only tools
- `performance`: performance agent loses `shell`, uses `executeCode` for benchmarks

## Impact

- `src/tools/index.js` — Remove `shell` from TOOL_PERMISSIONS, TOOL_CLASSIFICATIONS, ORCHESTRATOR_TOOLS, and TOOLS
- `src/tools/shell.js` — Make `shell` const private, keep `processTool` export
- `src/agent/deepAgents.js` — Remove `shell` from agent classification maps
- `tests/unit/shell.test.js` — Remove shell tool tests, keep process management tests
- `tests/unit/tool_index.test.js` — Remove shell assertions, fix permission tests
