## Context

`saveSession()` in `src/session/saver.js` currently calls `mkdir(dir, { recursive: true })` on every save. Since every message triggers a save, this means the directory creation check fires N times during a session. The desired behavior is: create/verify the directory once at init, then only validate it exists (no creation) during runtime — if it disappears after init, crash.

## Goals / Non-Goals

**Goals:**
- Move `mkdir(dir, { recursive: true })` out of `saveSession()` into a single `ensureSessionsDir()` function.
- Call `ensureSessionsDir()` exactly once at app startup in `index.js`.
- After successful init, `saveSession()` uses `stat()` to validate the directory exists — if missing, throws.
- Shutdown handler propagates `saveSession` errors as fatal (process exits with code 1).

**Non-Goals:**
- Re-creating the directory automatically after init failure — if startup ensure succeeds but the directory later vanishes, the app crashes.
- Adding retry or backoff logic for transient directory issues.
- Changes to checkpoint/SQLite persistence behavior.
- Modifying `writeMemoryFile()` (different code path, different scope).

## Decisions

**Decision: where `mkdir` lives**
- `ensureSessionsDir()` in `src/session/index.js` calls `mkdir(dir, { recursive: true })` — this handles both "directory exists" and "directory needs creation" at init time.
- `saveSession()` replaces the try/catch+mkdir block with `stat()` only — if the dir is missing, `stat` throws and the error propagates.

**Decision: call frequency**
- `ensureSessionsDir()` is called once in `index.js` after config load, before agent/tool creation. This is the single point of init-time directory setup.
- Runtime `saveSession()` calls no longer touch `mkdir` — they assume the directory exists (guaranteed by init).

**Decision: handling runtime directory disappearance**
- `saveSession()` does not catch `ENOENT` — it lets `stat()` throw.
- `shutdown.js:handleShutdown()` calls `saveSession()` during SIGTERM/SIGINT. Currently it catches errors and logs — change to re-throw save errors.
- The TUI `onSaveSession` callback in `index.js:223` also needs try/catch → `process.exit(1)`.

**Decision: directory path**
- `ensureSessionsDir()` resolves the path the same way as `saveSession`: `join(process.cwd(), "memory/sessions/")`.

## Risks / Trade-offs

[Risk] If disk goes read-only between init and the first save, `stat()` succeeds but `writeFile()` fails.
→ [Mitigation] `stat()` is the best indicator we can check. If `writeFile()` fails, the error propagates and crashes — acceptable for this change.

[Risk] `writeMemoryFile()` in `index.js:135` still silently creates directories via the memory module.
→ [Mitigation] Out of scope. `saveSession` is the function this change targets.
