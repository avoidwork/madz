## Context

The `file` tool (`src/tools/file/index.js`) currently exposes seven actions via `VALID_ACTIONS = ["read", "write", "edit", "delete", "ls", "glob", "grep"]` and dispatches all seven in `fileImpl`. The discovery impls `lsImpl`, `globImpl`, `grepImpl`, and `nativeSearch` live here, along with the shared path-resolution helpers `resolveBaseDir`/`resolveFilePath` and the `EXCLUDED_DIRS` constant. A standalone `grep` tool (`src/tools/grep/index.js`) already reuses `grepImpl` from `../file/index.js`. `src/tools/index.js` registers both `file` and `grep` in `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, and `TOOLS`.

The issue is to split discovery (ls, glob, grep) into a dedicated `discovery` tool so that read-only discovery can be granted to subagents without granting write access.

## Goals / Non-Goals

**Goals:**
- Create a `discovery` tool owning ls, glob, grep with read-only permission.
- Strip discovery from `file`, leaving CRUD only.
- Delete the standalone `grep` tool.
- Register `discovery` in all four tool maps; remove `grep`.
- Move and update tests; maintain coverage and lint.

**Non-Goals:**
- No change to `searchCode` (vector/FTS).
- No change to the `process` tool or shell execution.
- No new npm packages.

## Decisions

### Decision 1: Single `discovery` tool over standalone grep
The `grep` tool is a discovery operation and belongs with ls/glob under one discovery tool. A standalone grep plus a discovery tool with a grep action would be redundant. **Alternative considered:** keep grep standalone and only move ls/glob — rejected because grep is a discovery operation and the redundancy is undesirable.

### Decision 2: Read-only permission for `discovery`
The discovery tool requires only `filesystem:read`. This lets the orchestrator grant discovery to subagents without granting write access. **Alternative considered:** keep discovery under `file` with read+write — rejected because it defeats the separation of concerns.

### Decision 3: Move shared helpers into `discovery`
`resolveBaseDir`, `resolveFilePath`, and `EXCLUDED_DIRS` move to `discovery` since they are discovery-specific. `validatePath`/`checkFileLimit` stay in `src/tools/common.js` and are imported by both tools. The CRUD-specific helpers (`fuzzyMatch`, `generateUnifiedDiff`, `levenshteinDistance`, `suggestSimilarFile`) stay with `file`.

### Decision 4: Review `deepAgents.js` excludedTools
`src/agent/deepAgents.js:360` has `excludedTools: ["execute", "grep", "ls"]` which excludes the deepagents library's *built-in* filesystem tools, not madz's own tools. This list is reviewed to determine whether the new `discovery` tool name needs to be added (only if the deepagents library exposes a `discovery` tool).

## Risks / Trade-offs

- **[Breaking change]** Existing callers using `file` with `action: "ls"|"glob"|"grep"` must migrate to the `discovery` tool → Mitigation: update all internal callers and tests; the `discovery` tool is registered and discoverable.
- **[Breaking change]** The `grep` tool is removed → Mitigation: its capability is folded into `discovery`; update `tests/unit/tools/grep.test.js` to import from the new module.
- **[Test coverage]** Moving impl functions may break import paths in tests → Mitigation: update all test imports; run `npm run test`, `npm run lint`, `npm run coverage`.
- **[Binary safety]** The native grep fallback must skip binary files → Mitigation: keep the null-byte detection in `nativeSearch`.
- **[Path validation]** Every path must be validated against the sandbox allowlist → Mitigation: import `validatePath` from `../common.js` and validate before any filesystem access.
