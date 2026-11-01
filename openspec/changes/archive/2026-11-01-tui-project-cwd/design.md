# Design

## Context

`src/tui/app.js` holds three `useCallback` handlers — `handleSelectProject`,
`handleClearProject`, `handleNewSession` — that update the in-memory active-project state
via `setActiveProject`/`setProjectCwd` but never move the OS process cwd. Consumers that
read `process.cwd()` directly (the cron command builders in `src/scheduler/cron.js` and
`src/tools/cron/index.js`, which embed `cd ${process.cwd()}`) therefore run in the wrong
directory. See proposal.md for motivation.

The structured logger is imported as `import { logger } from "../shared/logger.js"` and
exposes `logger.error` (the established pattern in `src/session/shutdown.js` and
`src/tui/conversationArea.js`). `config` is already a prop of `App` and already a
dependency of `handleClearProject`.

## Goals / Non-Goals

**Goals:**
- Move the process cwd into the selected project on select.
- Restore the process cwd to `config.cwd` (fallback `process.cwd()`) on clear and on new
  session.
- Guard every `process.chdir` with try/catch + `logger.error` (AGENTS.md 1.1).

**Non-Goals:**
- Changing `src/workspace/loadAgents.js`'s module-load `process.cwd()` snapshot.
- Changing the active-project store or cron builder logic.

## Decisions

- **Guard shape.** Wrap each `process.chdir` in a `try { process.chdir(target); }
  catch (err) { logger.error(...); }`. Alternatives considered: a shared helper
  `safeChdir(target)` to avoid repetition. Given only three call sites and the KISS
  principle (AGENTS.md 1.4), a small inline guard is acceptable; a helper is preferred if
  the three blocks exceed three lines of duplicated logic. Decision: extract a tiny
  `safeChdir` closure to satisfy DRY without over-engineering.
- **Restore target.** `config.cwd || process.cwd()`. `config.cwd` is the madz root
  captured at load; the `process.cwd()` fallback covers the unset case.
- **`handleNewSession` deps.** Add `config` to its `useCallback` dependency array so the
  restore target is current. `handleSelectProject` takes `projectPath` as an argument, so
  its deps stay `[]`.

## Risks / Trade-offs

- [chdir mutates global process state, affecting the whole process] → This is the
  intended behavior; the TUI is a single-process app. Tests must save/restore the original
  cwd to avoid leaking state across test cases.
- [An invalid project path throws] → Guarded by try/catch + logger; the TUI continues.
- [The `loadAgents.js` snapshot does not track runtime chdir] → Explicitly out of scope;
  documented in the proposal and spec.

## Migration Plan

No data migration. Deploy by merging the change. Rollback is a simple revert of
`src/tui/app.js`.

## Open Questions

None.
