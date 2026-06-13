## 1. Add pino dependency

- [x] 1.1 Add `pino` to `dependencies` in `package.json` via `npm install pino`

## 2. Create logger module

- [x] 2.1 Create `src/logger.js` with OS-aware log directory detection (Alpine, Linux, macOS, Windows)
- [x] 2.2 Implement log directory auto-creation with `mkdirSync({ recursive: true })`
- [x] 2.3 Configure dual-file pino multistream: `madz.log` (info+) and `madz_error.log` (error only)
- [x] 2.4 Add silent-mode detection for `NODE_ENV === "test"` (redirect to `/dev/null` or set `level: 'silent'`)
- [x] 2.5 Export `logger` object with `info`, `warn`, `error`, `debug`, `fatal`, and `silent` methods
- [x] 2.6 Add graceful fallback: no crash if log directory is unwritable (fall back to `tmpdir()`)

## 3. Wire logger into shutdown handler

- [x] 3.1 Import `logger` in `src/session/shutdown.js`
- [x] 3.2 Call `await logger.flush()` before process exit in the shutdown handler (ensures all buffered logs are written)
- [x] 3.3 Add test: verify logger.flush() is called during graceful shutdown

## 4. Write unit tests for logger

- [x] 4.1 Create `tests/unit/logger.test.js`
- [x] 4.2 Test OS directory detection for all four platforms (Alpine, Linux, macOS, Windows)
- [x] 4.3 Test OS detection edge cases: empty `/etc/alpine-release`, non-existent `/etc/alpine-release` on Linux
- [x] 4.4 Test dual-file output: errors in both `madz.log` and `madz_error.log`, info only in `madz.log`
- [x] 4.5 Test silent mode: no files written when `NODE_ENV === "test"`
- [x] 4.6 Test graceful failure: logger initialized without crash when directory is unwritable
- [x] 4.7 Test that each log method (`info`, `warn`, `error`, `debug`, `fatal`) writes structured JSON
- [x] 4.8 Test shutdown flush: logger.flush() is called during shutdown

## 5. Replace console.* in src/ modules

- [x] 5.1 Replace `console.error` with `logger.error` in `src/session/shutdown.js`
- [x] 5.2 Replace `console.warn` with `logger.warn` in `src/tools/cron.js` (line ~301)
- [x] 5.3 Replace `console.warn` with `logger.warn` in `src/scheduler/autoSchedule.js` (lines ~98, 103, 110)
- [x] 5.4 Replace `console.warn` with `logger.warn` in `src/memory/gc.js` (line ~43)
- [x] 5.5 Remove `// oxlint-disable no-console` pragmas from the four `src/` files above
- [x] 5.6 Replace `console.warn` with `logger.warn` in `index.js` line 30 (crontab sync failure)
- [x] 5.7 Replace `console.log` with `logger.info` in `index.js` line 34 (crontab sync complete)
- [x] 5.8 Replace `console.warn` with `logger.warn` in `index.js` line 68 (persist failure)
- [x] 5.9 Replace `console.warn` with `logger.warn` in `index.js` line 74 (crontab sync error)
- [x] 5.10 Replace `console.log` with `logger.info` in `index.js` line 134 (GC idle callback)
- [x] 5.11 Replace `console.log` with `logger.info` in `index.js` line 143 (GC init message)
- [x] 5.12 Replace `console.warn` with `logger.warn` in `index.js` line 148 (GC init failure)
- [x] 5.13 Preserve `console.log`/`console.error` in `index.js` lines 322, 330, 335 for CLI user output (`--json` mode, chat responses)
- [x] 5.14 Remove `// oxlint-disable no-console` pragmas from `index.js` (lines 29/31, 33/37, 67/69, 73/75, 133/137, 142/144, 147/149, 320/332)

## 6. Validate and lint

- [x] 6.1 Run `npm run lint` and fix any oxlint/oxfmt violations
- [x] 6.2 Run `npm run test` and verify all tests pass
- [x] 6.3 Run `npm run coverage` and verify 100% coverage is maintained

## 7. Integration verification

- [x] 7.1 Run `node index.js --chat "hello"` and verify `madz.log` is created in the correct OS directory with structured JSON entries
- [x] 7.2 Verify `madz_error.log` is empty (no errors during normal run) or contains only error-level entries
- [x] 7.3 Verify shutdown flush: trigger graceful shutdown and confirm all log entries are present in `madz.log` (no truncated entries)
