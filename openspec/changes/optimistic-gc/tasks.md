## 1. Implementation

### 1.1 Create GC module
- [ ] 1.1.1 Create `src/memory/gc.js` with `gc()`, `isAvailable()`, and `initGC()` functions
- [ ] 1.1.2 Implement graceful degradation when `--expose-gc` is not available (one-time warning)
- [ ] 1.1.3 Implement idle detection timer with configurable timeout
- [ ] 1.1.4 Implement rate limiting (max GC calls per hour)

### 1.2 Integrate into index.js
- [ ] 1.2.1 Import and initialize GC manager after memory system initialization
- [ ] 1.2.2 Export GC manager for TUI integration
- [ ] 1.2.3 Add idle tracking hooks for chat mode

### 1.3 TUI Integration
- [ ] 1.3.1 Add `:gc` and `:gc status` commands to `commandParser.js`
- [ ] 1.3.2 Wire up `onActivity()` calls in `app.js` (user input, streaming start/stop)
- [ ] 1.3.3 Display GC result in status bar after manual `:gc` invocation

### 1.4 Configuration
- [ ] 1.4.1 Add `memory.gc.enabled`, `memory.gc.idleTimeoutMs`, and `memory.gc.maxGcPerHour` to `config.yaml`
- [ ] 1.4.2 Ensure config defaults match the design spec

### 1.5 Documentation
- [ ] 1.5.1 Update `README.md` with `--expose-gc` usage instructions
- [ ] 1.5.2 Update Dockerfile/docker-entrypoint.sh to support `--expose-gc` flag

## 2. Testing

### 2.1 Unit Tests
- [ ] 2.1.1 Test `gc()` returns `{ triggered: true }` when `--expose-gc` is available
- [ ] 2.1.2 Test `gc()` returns `{ triggered: false }` when not available
- [ ] 2.1.3 Test `isAvailable()` correctly detects `--expose-gc` status
- [ ] 2.1.4 Test `initGC()` sets up idle timer correctly

### 2.2 Integration Tests
- [ ] 2.2.1 Test GC triggers after idle timeout in TUI mode
- [ ] 2.2.2 Test `:gc` command triggers immediate GC
- [ ] 2.2.3 Test GC is debounced (multiple idle events don't trigger multiple GCs)
- [ ] 2.2.4 Test rate limiting prevents more than `maxGcPerHour` calls

### 2.3 Manual Verification
- [ ] 2.3.1 Run with `--expose-gc` and verify GC output
- [ ] 2.3.2 Run without `--expose-gc` and verify graceful degradation
- [ ] 2.3.3 Verify `:gc` command works in TUI
