## 1. Add ensureSessionsDir at init

- [x] 1.1 Create `ensureSessionsDir(sessionsDir)` function in `src/session/index.js` that resolves the path via `join(process.cwd(), sessionsDir)` and calls `mkdir(dir, { recursive: true })`
- [x] 1.2 Export `ensureSessionsDir` from `src/session/index.js`
- [x] 1.3 In `index.js`, call `ensureSessionsDir("memory/sessions/")` once after config load, before agent/tool creation

## 2. Simplify saveSession to pure writeFile

- [x] 2.1 In `src/session/saver.js`, remove the `try { await stat(dir) } catch { await mkdir(...) }` block (lines 13-17)
- [x] 2.2 Remove `mkdir` and `stat` from the import from `node:fs/promises`
- [x] 2.3 Add `@throws {Error}` JSDoc to `saveSession()` documenting that unhandled filesystem errors propagate

## 3. Update shutdown handler to propagate fatal errors

- [x] 3.1 In `src/session/shutdown.js`, modify `handleShutdown()` so that `saveSession()` errors are not caught — narrow the try/catch to only surround `flushTelemetry()`
- [x] 3.2 Keep telemetry flush errors suppressed (log but don't throw) but let session save errors propagate

## 4. Update TUI save callback for fatal errors

- [x] 4.1 `onSaveSession` callback calls `saveSession()` directly; errors propagate to shutdown handler

## 5. Write and update tests

- [x] 5.1 Add test: `ensureSessionsDir` creates directory when missing (using a temp directory)
- [x] 5.2 Add test: `ensureSessionsDir` returns successfully when directory already exists
- [x] 5.3 Add test: `saveSession` writes file successfully when directory exists (existing behavior)
- [x] 5.4 Add test: `saveSession` propagates writeFile errors unhandled
- [x] 5.5 Add test: `handleShutdown` re-throws errors from `saveSession`
