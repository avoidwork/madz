## Implementation Tasks

### 1. Config Schema

- [ ] 1.1 Add `gc` sub-object to `MemorySchema` in `src/config/schemas.js`
  - [ ] `enabled: z.boolean().default(true)`
  - [ ] `intervalMs: z.number().int().positive().default(30000)`
  - [ ] `idleTimeoutMs: z.number().int().positive().default(10000)`
  - [ ] `heapThreshold: z.number().min(0).max(1).default(0.8)`
  - [ ] `gc: z.object({...}).default({})`
- [ ] 1.2 Add `gc` defaults to `DEFAULT_CONFIG.memory` in `src/config/schemas.js`
- [ ] 1.3 Add test: `tests/unit/config/gc.test.js` — validates gc config parsing
  - [ ] Test default gc config values
  - [ ] Test custom gc config values
  - [ ] Test gc disabled via config

### 2. GC Manager Module

- [ ] 2.1 Create `src/memory/gc.js` — `GcManager` class
  - [ ] `constructor(config)` — stores config, initializes state
  - [ ] `start()` — starts the interval timer
  - [ ] `stop()` — clears interval timer
  - [ ] `_check()` — periodic check: heap + idle
  - [ ] `_collect()` — calls `global.gc()` if conditions met
  - [ ] `isIdle()` — getter for idle state
  - [ ] `setIdle(value)` — setter for idle state
- [ ] 2.2 Idle detection logic
  - [ ] Track `isIdle` boolean (default: true)
  - [ ] Track `lastActivityTime` monotonic timestamp
  - [ ] `_check()` only triggers GC when `isIdle && (now - lastActivityTime >= idleTimeoutMs)`
- [ ] 2.3 Heap check logic
  - [ ] Read `process.memoryUsage()`
  - [ ] Compute `heapUsed / heapTotal`
  - [ ] Compare against `heapThreshold`
- [ ] 2.4 Graceful degradation
  - [ ] Check `typeof global.gc === 'function'` on first `_check()`
  - [ ] If unavailable: log warning once, set `gcAvailable = false`
  - [ ] If `gcAvailable === false`: skip all subsequent checks silently
- [ ] 2.5 Logging
  - [ ] Log GC trigger: `[gc] triggered: heap at X%`
  - [ ] Log warning (once): `[gc] V8 GC not available (node --expose-gc required)`
- [ ] 2.6 Export `GcManager` as default export

### 3. TUI Integration

- [ ] 3.1 In `index.js`, instantiate `GcManager` and wire to TUI
  - [ ] Import `GcManager` from `./src/memory/gc.js`
  - [ ] Create `gcManager = new GcManager(config.memory)`
  - [ ] Call `gcManager.start()` if `config.memory.gc?.enabled !== false`
  - [ ] Export `gcManager` for TUI access
- [ ] 3.2 In `src/tui/app.js`, add idle callbacks
  - [ ] Accept `setIsBusy` and `setIsIdle` props
  - [ ] Call `setIsBusy()` when streaming starts (`setStatusMessage("Streaming...")`)
  - [ ] Call `setIsIdle()` when streaming completes (after `setStatusMessage("Received response")`)
  - [ ] Call `setIsIdle()` when streaming errors out (in catch block)
- [ ] 3.3 In `index.js`, pass callbacks to App component
  - [ ] `setIsBusy: () => gcManager.setIdle(false)`
  - [ ] `setIsIdle: () => gcManager.setIdle(true)`

### 4. Dockerfile

- [ ] 4.1 Update docker-entrypoint.sh or profile to include `--expose-gc`
  - [ ] Change `exec npm start` to `exec node --expose-gc index.js --mode interactive`
  - [ ] Ensure this only applies to the interactive mode path

### 5. Tests

- [ ] 5.1 `tests/unit/gc.test.js` — GC Manager unit tests
  - [ ] Test: GC triggers when heap threshold exceeded and idle
  - [ ] Test: GC does not trigger when not idle
  - [ ] Test: GC does not trigger when below threshold
  - [ ] Test: GC does not trigger when disabled
  - [ ] Test: GC warns once when --expose-gc unavailable, then skips
  - [ ] Test: GC uses custom interval and thresholds from config
  - [ ] Test: idle timeout prevents GC during brief idle periods
- [ ] 5.2 `tests/unit/config/gc.test.js` — Config schema tests (see 1.3)

### 6. Integration / Verification

- [ ] 6.1 Run full test suite: `npm test`
- [ ] 6.2 Verify lint passes: `npm run lint`
- [ ] 6.3 Manual test: Run `node --expose-gc index.js --mode interactive`, verify GC logs appear
- [ ] 6.4 Manual test: Run without `--expose-gc`, verify single warning appears
- [ ] 6.5 Update `README.md` — document `memory.gc` config section
