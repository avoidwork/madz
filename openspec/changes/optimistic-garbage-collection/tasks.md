## 1. Config Schema

- [ ] 1.1 Add `memory.gc` section to config with defaults: `messageWindow: 100`, `maxContextEntries: 100`, `idleMs: 30000`
- [ ] 1.2 Update config loader to validate new `memory.gc` fields with sensible defaults

## 2. GC Utility Module

- [ ] 2.1 Create `src/memory/gc.js` with `gcCollect(messages, config)` function
- [ ] 2.2 Implement message window trimming: slice `messages` array to keep last N entries
- [ ] 2.3 Implement memory context entry enforcement: call `enforceMaxEntries` from `retention.js`
- [ ] 2.4 Ensure `gcCollect` is idempotent and throws no errors on empty/short arrays

## 3. TUI Message Trimming

- [ ] 3.1 Wire `gcCollect` into `src/tui/app.js` after each exchange completes (in `handleChat` success path)
- [ ] 3.2 Wire `gcCollect` into `src/tui/app.js` via idle timer using `queueMicrotask` for non-blocking execution
- [ ] 3.3 Pass config and messages array to `gcCollect` from TUI state

## 4. Memory Context Entry Enforcement

- [ ] 4.1 Wire `enforceMaxEntries` into `src/memory/loadMemories.js` after loading entries
- [ ] 4.2 Pass `maxContextEntries` from config to `enforceMaxEntries` call
- [ ] 4.3 Ensure enforcement runs during GC cycle and optionally during load

## 5. TUI GC Command

- [ ] 5.1 Add `:gc` command parsing to `src/tui/commandParser.js`
- [ ] 5.2 Implement GC command handler in `src/tui/app.js` that calls `gcCollect` and displays status

## 6. Tests

- [ ] 6.1 Add unit tests for `gcCollect` function in `tests/unit/gc.test.js`
- [ ] 6.2 Test message window trimming with arrays of various sizes
- [ ] 6.3 Test memory context entry enforcement with configurable limits
- [ ] 6.4 Test GC idempotency (multiple calls, empty arrays)
- [ ] 6.5 Test `:gc` command parsing and execution in TUI

## 7. Integration & Polish

- [ ] 7.1 Run full test suite and verify all tests pass
- [ ] 7.2 Run linter and formatter (`npm run fix`)
- [ ] 7.3 Update README with GC configuration reference
- [ ] 7.4 Update `memory-system` spec delta (already created)
