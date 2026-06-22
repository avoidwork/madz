## 1. Implementation

### 1.1 Create GC module
- [x] 1.1.1 Create `src/memory/gc.js` with `gc()`, `isAvailable()`, and `initGC()` functions
- [x] 1.1.2 Implement graceful degradation when `--expose-gc` is not available (one-time warning)
- [x] 1.1.3 Implement idle detection timer with configurable timeout
- [x] 1.1.4 Implement rate limiting (max GC calls per hour)

### 1.2 Integrate into index.js
- [x] 1.2.1 Import and initialize GC manager after memory system initialization
- [x] 1.2.2 Export GC manager for TUI integration
- [x] 1.2.3 Add idle tracking hooks for chat mode

### 1.3 TUI Integration
- [x] 1.3.1 Add `:gc` and `:gc status` commands to `commandParser.js`
- [x] 1.3.2 Wire up `onActivity()` calls in `app.js` (user input, streaming start/stop)
- [x] 1.3.3 Display GC result in status bar after manual `:gc` invocation

### 1.4 Configuration
- [x] 1.4.1 Add `memory.gc.enabled`, `memory.gc.idleTimeoutMs`, and `memory.gc.maxGcPerHour` to `config.yaml`
- [x] 1.4.2 Ensure config defaults match the design spec

### 1.5 Documentation
- [x] 1.5.1 Update `README.md` with `--expose-gc` usage instructions
- [x] 1.5.2 Update Dockerfile/docker-entrypoint.sh to support `--expose-gc` flag

## 2. Testing

### 2.1 Unit Tests
- [x] 2.1.1 Test `gc()` returns `{ triggered: true }` when `--expose-gc` is available
- [x] 2.1.2 Test `gc()` returns `{ triggered: false }` when not available
- [x] 2.1.3 Test `isAvailable()` correctly detects `--expose-gc` status
- [x] 2.1.4 Test `initGC()` sets up idle timer correctly

### 2.2 Integration Tests
- [x] 2.2.1 Test GC triggers after idle timeout in TUI mode
- [x] 2.2.2 Test `:gc` command triggers immediate GC
- [x] 2.2.3 Test GC is debounced (multiple idle events don't trigger multiple GCs)
- [x] 2.2.4 Test rate limiting prevents more than `maxGcPerHour` calls

### 2.3 Manual Verification
- [x] 2.3.1 Run with `--expose-gc` and verify GC output
- [x] 2.3.2 Run without `--expose-gc` and verify graceful degradation
- [x] 2.3.3 Verify `:gc` command works in TUI
