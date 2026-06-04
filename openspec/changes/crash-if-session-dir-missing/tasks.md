## 1. Add ensureSessionsDir at init

- [ ] 1.1 Create `ensureSessionsDir(sessionsDir)` function in `src/session/index.js` that resolves the path via `join(process.cwd(), sessionsDir)` and calls `mkdir(dir, { recursive: true })`
- [ ] 1.2 Export `ensureSessionsDir` from `src/session/index.js`
- [ ] 1.3 In `index.js`, call `ensureSessionsDir("memory/sessions/")` once after config load, before agent/tool creation

## 2. Replace mkdir with stat in saveSession

- [ ] 2.1 In `src/session/saver.js`, remove the `try { await stat(dir) } catch { await mkdir(...) }` block
- [ ] 2.2 Add `const { stat }` to imports from `node:fs/promises`
- [ ] 2.3 Add a `stat(dir)` call at the top of `saveSession()` — if it throws, the error propagates (no catch)
- [ ] 2.4 Add `@throws {Error}` JSDoc annotation documenting that the function throws if the directory does not exist

## 3. Update shutdown handler to propagate fatal errors

- [ ] 3.1 In `src/session/shutdown.js`, modify `handleShutdown()` to not catch errors from `saveSession` — remove the outer `try/catch` block or narrow it to only wrap `flushTelemetry`
- [ ] 3.2 Keep telemetry flush errors suppressed (log but don't throw) but let session save errors propagate

## 4. Update TUI save callback for fatal errors

- [ ] 4.1 In `index.js`, wrap the `onSaveSession` callback (line 223-224) in try/catch and call `process.exit(1)` on error with a logged message about the missing sessions directory

## 5. Write and update tests

- [ ] 5.1 Add test: `ensureSessionsDir` creates directory when missing (using a temp directory)
- [ ] 5.2 Add test: `ensureSessionsDir` returns successfully when directory already exists
- [ ] 5.3 Update `saveSession` test: verify it throws when directory does not exist
- [ ] 5.4 Update `saveSession` test: verify it still succeeds when directory exists (existing behavior)
- [ ] 5.5 Add test: `handleShutdown` re-throws errors from `saveSession`
