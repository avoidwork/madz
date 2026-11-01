# Proposal

## Why

The TUI's `/projects` panel updates in-memory active-project state but never moves the
OS process working directory. `handleSelectProject`, `handleClearProject`, and
`handleNewSession` in `src/tui/app.js` call `setActiveProject`/`setProjectCwd` but omit
`process.chdir`, so consumers that read `process.cwd()` directly — the cron command
builders in `src/scheduler/cron.js` and `src/tools/cron/index.js` (which embed
`cd ${process.cwd()}`) — run in the wrong directory. This change wires the process cwd
to the active project.

## What Changes

- `handleSelectProject` moves the process into the selected project via a guarded
  `process.chdir(projectPath)`.
- `handleClearProject` restores the process cwd to `config.cwd` (fallback
  `process.cwd()`) via a guarded `process.chdir`.
- `handleNewSession` restores the process cwd to `config.cwd` (fallback
  `process.cwd()`) for consistency, and adds `config` to its `useCallback` deps.
- Every `process.chdir` call is wrapped in try/catch that records failures through the
  structured logger (`logger.error`), per AGENTS.md 1.1 — no silent catch, no crash.

## Capabilities

### New Capabilities
- `tui-project-cwd`: The TUI moves the OS process working directory in lockstep with the
  active project — into the project on select, back to `config.cwd` on clear and on new
  session — with guarded, logged `process.chdir` calls.

### Modified Capabilities
<!\-\- none \-\->

## Non-goals

- Changing `src/workspace/loadAgents.js`'s module-load `process.cwd()` snapshot semantics
  (a separate concern; callers must pass `targetCwd` explicitly).
- Altering the active-project in-memory store (`src/workspace/project.js`).
- Changing cron command builder logic beyond the fact that they now read a correct cwd.

## Impact

- `src/tui/app.js` — three handlers gain guarded `process.chdir` calls; `logger` import
  added; `handleNewSession` deps updated.
- `tests/unit/tui/app.test.js` — regression tests for select/clear/invalid-path.
- No API, dependency, or config changes.
