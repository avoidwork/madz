## Context

`saveSession()` in `src/session/saver.js` currently calls `stat()` + `mkdir()` on every save call. Since every message triggers a save, this means redundant filesystem checks and directory creation fire N times during a session. The desired behavior: ensure/verify the directory once at init, then `saveSession()` is a pure `writeFile` with no extra checks.

## Goals / Non-Goals

**Goals:**
- Create `ensureSessionsDir()` in `src/session/index.js` that calls `mkdir(dir, { recursive: true })` — used once at init.
- Call `ensureSessionsDir()` exactly once in `index.js` after config load, before agent/tool creation.
- Simplify `saveSession()` in `src/session/saver.js` to a pure `writeFile` — no `stat`, no `mkdir`. If the write fails, the unhandled error crashes.
- Shutdown handler propagates `saveSession()` errors as fatal (process exits with code 1).

**Non-Goals:**
- Adding retry or backoff for transient write failures.
- Changes to `writeMemoryFile()` (different code path).
- Changes to checkpoint/SQLite persistence behavior.

## Decisions

**Decision: `saveSession()` has no filesystem checks**
- `saveSession()` only resolves the output path and calls `writeFile()`. No `stat()`, no `mkdir()`.
- Rationale: `ensureSessionsDir()` at init guarantees the directory exists. If it later disappears, `writeFile()` throws naturally — the crash is the signal.

**Decision: `ensureSessionsDir()` is called exactly once**
- Called in `index.js` right after config load, before agent/tool initialization.
- Uses `mkdir(dir, { recursive: true })` to handle both "already exists" and "needs creation" in a single call.

**Decision: handling runtime write failures**
- `handleShutdown()` in `shutdown.js` catches errors from all shutdown steps. Change to re-throw `saveSession` errors.
- The TUI `onSaveSession` callback in `index.js:223` needs try/catch → `process.exit(1)`.

## Risks / Trade-offs

[Risk] If a file write fails on a non-directory issue (disk full, permissions), the crash provides no differentiation.
→ [Mitigation] Acceptable — the process is crashing anyway and the error message includes the underlying OS error.

[Risk] `writeMemoryFile()` in `index.js:135` still creates directories via the memory module.
→ [Mitigation] Out of scope. `saveSession` is the function this change targets.
