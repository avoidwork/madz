## Why

The `file` tool currently mixes CRUD operations (read, write, edit, delete) with discovery operations (ls, glob, grep). This violates single responsibility — a tool that writes files and a tool that searches the filesystem have different permission profiles, failure modes, and usage patterns. Separating them lets each tool be described, permissioned, and tested independently, and lets the orchestrator grant discovery tools to subagents without granting write access.

## What Changes

- Add a new `discovery` tool at `src/tools/discovery/index.js` that owns ls, glob, and grep. It exposes `action` (ls, glob, grep), `path`, `pattern`, and `maxResults`, and requires only `filesystem:read`.
- **BREAKING**: Strip `ls`, `glob`, `grep` from the `file` tool's `VALID_ACTIONS` and `fileImpl` switch, leaving only read, write, edit, delete. Move `lsImpl`, `globImpl`, `grepImpl`, `nativeSearch`, `resolveBaseDir`, `resolveFilePath`, and `EXCLUDED_DIRS` into the new tool.
- **BREAKING**: Delete the standalone `grep` tool at `src/tools/grep/index.js` — its capability is folded into `discovery`.
- Register `discovery` in `src/tools/index.js` (`TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, `TOOLS`) and remove `grep` from all four maps.
- Review `src/agent/deepAgents.js` `excludedTools` for the new tool name.
- Move and update tests: new `tests/unit/tools/discovery.test.js` and `tests/integration/tools/discovery.test.js`; update `tests/unit/tools/grep.test.js`; trim `file` tests to CRUD-only; update `tests/unit/tool_index.test.js`.

## Capabilities

### New Capabilities
- `discovery-tool`: a dedicated `discovery` tool that performs filesystem discovery (ls, glob, grep) with read-only permission and sandbox path validation.

### Modified Capabilities
- `own-file-tool`: the `file` tool's `ls`, `glob`, and `grep` actions are removed from `VALID_ACTIONS`, so `file` is CRUD-only.

## Impact

- `src/tools/discovery/index.js` — new tool.
- `src/tools/file/index.js` — strip discovery actions, keep CRUD.
- `src/tools/grep/index.js` — deleted.
- `src/tools/index.js` — registration points.
- `src/agent/deepAgents.js` — review `excludedTools`.
- `tests/unit/tools/discovery.test.js` — new tests.
- `tests/integration/tools/discovery.test.js` — new tests.
- `tests/unit/tools/grep.test.js` — update import path.
- `tests/unit/tools/file.test.js` — trim to CRUD.
- `tests/integration/tools/file.test.js` — trim to CRUD.
- `tests/unit/tool_index.test.js` — guard test update.

## Non-goals

- No change to `searchCode` (vector/FTS) or the deepagents tool set beyond reviewing `excludedTools`.
- No change to the `process` tool or shell execution.
- No new npm packages.
