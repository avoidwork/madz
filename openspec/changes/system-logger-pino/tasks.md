## 1. Add pino dependency

- [ ] 1.1 Add `pino` to `dependencies` in `package.json` via `npm install pino`

## 2. Create logger module

- [ ] 2.1 Create `src/logger.js` with OS-aware log directory detection (Alpine, Linux, macOS, Windows)
- [ ] 2.2 Implement log directory auto-creation with `mkdirSync({ recursive: true })`
- [ ] 2.3 Configure dual-file pino transports: `madz.log` (all levels) and `madz_error.log` (error only)
- [ ] 2.4 Add silent-mode detection for `NODE_ENV === "test"`
- [ ] 2.5 Export `logger` object with `info`, `warn`, `error`, `debug`, `fatal`, and `silent` methods
- [ ] 2.6 Add graceful fallback: no crash if log directory is unwritable

## 3. Write unit tests for logger

- [ ] 3.1 Create `tests/unit/logger.test.js`
- [ ] 3.2 Test OS directory detection for all four platforms (Alpine, Linux, macOS, Windows)
- [ ] 3.3 Test dual-file output: errors in both `madz.log` and `madz_error.log`, info only in `madz.log`
- [ ] 3.4 Test silent mode: no files written when `NODE_ENV === "test"`
- [ ] 3.5 Test graceful failure: logger initialized without crash when directory is unwritable
- [ ] 3.6 Test that each log method (`info`, `warn`, `error`, `debug`, `fatal`) writes structured JSON

## 4. Replace console.* in src/ modules

- [ ] 4.1 Replace `console.error` with `logger.error` in `src/session/shutdown.js`
- [ ] 4.2 Replace `console.warn` with `logger.warn` in `src/tools/cron.js`
- [ ] 4.3 Replace `console.warn` with `logger.warn` in `src/scheduler/autoSchedule.js`
- [ ] 4.4 Replace `console.warn` with `logger.warn` in `src/memory/gc.js`
- [ ] 4.5 Remove `// oxlint-disable no-console` pragmas from the above four files
- [ ] 4.6 Replace `console.log` with `logger.info` and `console.warn` with `logger.warn` in `index.js` for non-CLI output paths (scheduler sync messages, GC messages)
- [ ] 4.7 Preserve `console.log`/`console.error` in `index.js` for CLI user output (`--json` mode, chat responses, TUI) and remove `// oxlint-disable no-console` where applicable

## 5. Validate and lint

- [ ] 5.1 Run `npm run lint` and fix any oxlint/oxfmt violations
- [ ] 5.2 Run `npm run test` and verify all tests pass
- [ ] 5.3 Run `npm run coverage` and verify 100% coverage is maintained

## 6. Integration verification

- [ ] 6.1 Run `node index.js --chat "hello"` and verify `madz.log` is created in the correct OS directory with structured JSON entries
- [ ] 6.2 Verify `madz_error.log` is empty (no errors during normal run) or contains only error-level entries
