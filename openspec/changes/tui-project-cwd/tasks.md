# Tasks

## 1. Guarded chdir helper

- [ ] 1.1 Import `logger` from `../shared/logger.js` in `src/tui/app.js`.
- [ ] 1.2 Add a small `safeChdir(target)` guard that wraps `process.chdir(target)` in
  try/catch and records failures via `logger.error` (no silent catch, no crash).

## 2. Wire handlers

- [ ] 2.1 In `handleSelectProject`, call `safeChdir(projectPath)` after
  `setProjectCwd(projectPath)`.
- [ ] 2.2 In `handleClearProject`, call `safeChdir(config.cwd || process.cwd())` after
  `setProjectCwd("")`.
- [ ] 2.3 In `handleNewSession`, call `safeChdir(config.cwd || process.cwd())` and add
  `config` to its `useCallback` dependency array.

## 3. Regression tests

- [ ] 3.1 In `tests/unit/tui/app.test.js`, add a test asserting `process.cwd()` reflects
  the selected project after `handleSelectProject` (save/restore the original cwd).
- [ ] 3.2 Add a test asserting `process.cwd()` restores to `config.cwd` after
  `handleClearProject`.
- [ ] 3.3 Add a test for the invalid-path case: `process.chdir` throws, the logger records
  it, and no exception propagates.

## 4. Verify

- [ ] 4.1 Run `npm run test` and confirm all tests pass.
- [ ] 4.2 Run `npm run coverage` and confirm coverage is maintained.
