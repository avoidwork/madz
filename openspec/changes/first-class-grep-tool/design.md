## Context

The `file` tool exposes a `grep` action (`grepImpl`) and a `search` action (`searchImpl`) that are functionally identical. Both shell out to ripgrep (`rg`) with `\-\-line-number \-\-no-heading -n` and fall back to `nativeSearch` (a native fs walk) when `rg` is absent. The deepagents `grep` tool was removed, so the capability is only reachable via `file`'s action enum, which is not discoverable as a first-class operation.

## Goals / Non-Goals

**Goals:**
- Add a first-class `grep` tool that is directly callable with `{ pattern, path?, maxResults? }`.
- Reuse the existing `grepImpl`/`nativeSearch` logic (DRY) rather than duplicating search code.
- Remove the redundant `search` action from `file` so `grep` is the single grep entry point.
- Register the tool across all four registration points in `src/tools/index.js`.

**Non-Goals:**
- No change to `searchCode` (vector/FTS) or the deepagents tool set.
- No change to the `process` tool or shell execution.

## Decisions

### Decision 1: Reuse `grepImpl`/`nativeSearch` from the file tool
The new `grep` tool re-exports and reuses `grepImpl` and `nativeSearch` from `src/tools/file/index.js` rather than rewriting search logic. This keeps a single source of truth for the grep implementation (DRY).

- **Alternative considered:** Duplicating the ripgrep/native-search logic in the new tool. Rejected — violates DRY and risks drift between the two implementations.

### Decision 2: Remove the `search` action from `file`
`searchImpl` is functionally identical to `grepImpl`. Keeping both creates two overlapping grep entry points. The `search` action is removed from `VALID_ACTIONS` and the `fileImpl` switch, so `grep` is the single consistent entry point.

- **Alternative considered:** Keeping both `file`'s `search`/`grep` actions and the new `grep` tool. Rejected — creates two overlapping grep entry points.

### Decision 3: Security — `execFile`, not `sh -c`
The grep tool invokes ripgrep via `execFile` (no shell interpolation of the pattern), matching the existing `grepImpl`. Path validation reuses `validatePath` against the sandbox allowlist.

## Risks / Trade-offs

- **[Removing `search` may break existing tests]** → The `file` tool tests that reference `search` must be updated; the `grep` tool covers the same functionality.
- **[Tool registration drift]** → The tool must be added to all four registration points (`TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, `TOOLS`); the guard test enforces this.
