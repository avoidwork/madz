## Why

The `shell` and `process` tools are a designed pair but require jumping between two tools for process lifecycle management. The `shell` tool with `background: true` starts a process and returns a PID, but the `process` tool is what actually manages it — reading output, waiting for completion, killing, sending input. This handoff creates verbosity in conversation history and adds cognitive overhead for the agent. Additionally, background processes are spawned with `stdio: ["ignore", "ignore", "ignore"]`, making stdout/stderr irretrievable — the `process` tool's `log` action returns placeholder text instead of actual output.

## What Changes

- Merge `shell` and `process` tools into a single unified tool with an `action` parameter
- New action enum: `start`, `wait`, `kill`, `log`, `write`, `pause`, `resume`, `list`
- Fix background spawn to use `stdio: ["ignore", "pipe", "pipe"]` so output is captured
- Implement `log` action to return actual captured stdout/stderr (not placeholder text)
- Add `list` action to return all tracked processes with status
- Remove `src/tools/shell.js` after migrating all functionality
- Update tool registration in `src/tools/index.js`
- Add comprehensive unit and integration tests

## Capabilities

### New Capabilities
- `unified-process-tool`: Unified tool interface for shell execution and process lifecycle management with action-based routing

### Modified Capabilities
- `tool-schema-validation`: Schema now includes action enum with 8 variants instead of separate shell/process schemas
- `tools-tier2`: Tool registration changes — two tools become one, permissions and classifications merged

## Impact

- **Affected code**: `src/tools/shell.js` (remove), `src/tools/process.js` (rewrite), `src/tools/index.js` (update registration)
- **Tests**: `tests/unit/tools/shell.test.js` (remove), `tests/unit/tools/process.test.js` (rewrite), `tests/unit/tools/tool_index.test.js` (update), `tests/integration/full-flow.test.js` (add integration test)
- **Documentation**: `AGENTS.md` tool descriptions, skill files referencing shell/process tools
- **Breaking change**: Agents previously using separate `shell` and `process` tools must now use the unified `process` tool with action parameter

## Non-goals

- Do not change the processTracker internal state management (shared Map remains)
- Do not add new spawn options beyond stdio fix
- Do not modify permission model (existing filesystem:exec + process:spawn preserved)
- Do not refactor other tools or subsystems