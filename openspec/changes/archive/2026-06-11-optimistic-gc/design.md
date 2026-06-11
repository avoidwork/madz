## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        index.js                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Boot sequence                                         │  │
│  │  1. Load config                                       │  │
│  │  2. Sync crontab                                      │  │
│  │  3. Init memory system                                │  │
│  │  4. Init GC manager (if enabled)                      │  │
│  │  5. Load agent, tools, session                        │  │
│  │  6. Start TUI / chat mode                             │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  GC Manager (idle detection)                           │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  State: { active: boolean, idleTimer: null }     │  │  │
│  │  │                                                  │  │  │
│  │  │  onActivity()  →  clear idleTimer, set active    │  │  │
│  │  │  onIdle()      →  trigger gc() if enabled        │  │  │
│  │  │                                                  │  │  │
│  │  │  Triggered by:                                   │  │  │
│  │  │  - User input (handleSubmit)                     │  │  │
│  │  │  - Streaming start/stop                          │  │  │
│  │  │  - Tool call start/end                           │  │  │
│  │  │  - TUI :gc command                               │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 5. Graceful Degradation

```javascript
if (!global.gc) {
  if (!gcWarnedOnce) {
    console.warn('[gc] V8 GC not available. Start with --expose-gc flag.');
    gcWarnedOnce = true;
  }
  return { triggered: false, reason: 'gc not available' };
}
```

The warning is logged only once per process lifetime. The system continues normally without GC.

## Configuration

```yaml
memory:
  gc:
    enabled: true              # Enable/disable GC (default: true)
    idleTimeoutMs: 300000      # Idle time before GC triggers (default: 5 min)
    maxGcPerHour: 4            # Rate limit: max GC calls per hour
```

## npm start Consistency

The `npm start` script is `node index.js --mode interactive`. To enable GC:

```bash
npm start -- --expose-gc
# or
node --expose-gc index.js --mode interactive
```

For Docker:
```dockerfile
CMD ["node", "--expose-gc", "index.js", "--mode", "interactive"]
```

## Testing Strategy

1. **Unit tests** (`tests/unit/gc.test.js`):
   - `gc()` returns `{ triggered: true }` when `--expose-gc` is available
   - `gc()` returns `{ triggered: false }` when not available
   - `isAvailable()` correctly detects `--expose-gc` status
   - `initGC()` sets up idle timer correctly

2. **Integration tests**:
   - GC triggers after idle timeout in TUI mode
   - `:gc` command triggers immediate GC
   - GC is debounced (multiple idle events don't trigger multiple GCs)
   - Rate limiting prevents more than `maxGcPerHour` calls

3. **Manual testing**:
   - Run with `--expose-gc` and verify GC output
   - Run without `--expose-gc` and verify graceful degradation
   - Verify `:gc` command works in TUI
