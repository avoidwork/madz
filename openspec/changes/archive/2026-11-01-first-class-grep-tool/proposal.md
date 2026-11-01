## Why

The orchestrator and subagents frequently need to search file contents by regex. The deepagents `grep` tool was removed (excluded via `excludedTools: ["execute", "grep", "ls"]` in `src/agent/deepAgents.js`). The capability still exists as a `grep` action on the `file` tool (`grepImpl` in `src/tools/file/index.js`), but it is not surfaced as a first-class tool — the model must know to call `file` with `action: "grep"`. A dedicated `grep` tool makes the operation discoverable and directly callable.

## What Changes

- Add a new `grep` tool at `src/tools/grep/index.js` that accepts `pattern` (required), `path` (optional), and `maxResults` (optional), reusing the existing `grepImpl`/`nativeSearch` logic from `src/tools/file/index.js`.
- Register `grep` in `src/tools/index.js`: `TOOL_PERMISSIONS` (`filesystem:read`), `TOOL_CLASSIFICATIONS` (search, research, coding, debug, code-review, security-audit, testing, performance, documentation), `ORCHESTRATOR_TOOLS`, and the `TOOLS` map.
- Remove the redundant `search` action from `file`'s `VALID_ACTIONS` and the `fileImpl` switch, so `grep` is the single consistent grep entry point.
- Add unit tests (`tests/unit/tools/grep.test.js`) and update the guard test (`tests/unit/tool_index.test.js`).

## Capabilities

### New Capabilities
- `grep-tool`: a first-class `grep` tool that performs literal regex search across files, reusing the existing ripgrep/native-fs logic.

### Modified Capabilities
- `own-file-tool`: the `file` tool's `search` action is removed from `VALID_ACTIONS`, so `grep` is the single grep entry point.

## Impact

- `src/tools/grep/index.js` — new tool.
- `src/tools/file/index.js` — remove `search` from `VALID_ACTIONS` and the `fileImpl` switch.
- `src/tools/index.js` — registration points.
- `tests/unit/tools/grep.test.js` — new tests.
- `tests/unit/tool_index.test.js` — guard test update.

## Non-goals

- No change to `searchCode` (vector/FTS) or the deepagents tool set.
- No change to the `process` tool or shell execution.
