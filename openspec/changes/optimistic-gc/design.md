# Design: Optimistic Garbage Collection

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   index.js (entry)                    │
│                                                       │
│  Load GC manager ──► gcManager.start(config.memory)   │
│  Export gcManager.isIdle() for TUI integration        │
└──────────────────┬───────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌───────────────┐    ┌──────────────────┐
│  GC Manager   │    │   TUI App        │
│  (src/memory/ │    │  (src/tui/app.js)│
│   gc.js)      │    │                  │
│               │    │  Streaming on    │
│  Timer: 30s   │    │  ──► setIsBusy   │
│  check:       │    │  Streaming off   │
│  - heap?      │    │  ──► setIsIdle   │
│  - idle?      │    │                  │
│               │    │  exports:        │
│  global.gc()  │    │  setIsBusy,      │
└───────────────┘    │  setIsIdle       │
                     └──────────────────┘
```

## Components

### 1. GC Manager (`src/memory/gc.js`)

A class that owns the GC lifecycle:

```javascript
class GcManager {
  constructor(config)
  start()    // starts the timer
  stop()     // clears the timer, stops collection
  _check()   // periodic check: heap + idle
  _collect() // calls global.gc() if conditions met
}
```

**Check logic (runs every `intervalMs`):**

1. If gc is disabled → skip
2. If not idle → skip (TUI is streaming/processing)
3. If heapUsed / heapTotal < heapThreshold → skip
4. If heap threshold met → call `global.gc()`
5. Log: "GC triggered: heap at X%"

**Idle detection:**
- `setIdle(false)` called by TUI when streaming starts
- `setIdle(true)` called by TUI when streaming ends
- GC only runs when `isIdle()` returns `true`
- Monotonic idle timeout: TUI must have been idle for at least `idleTimeoutMs` before GC fires. Prevents GC from firing during brief pauses between user input and assistant response.

### 2. TUI Integration (`src/tui/app.js`)

The App component receives callbacks via props:

```javascript
<App
  setIsBusy={() => gcManager.setIdle(false)}
  setIsIdle={() => gcManager.setIdle(true)}
  ...
/>
```

Called at streaming boundaries:
- `setIsBusy()` — when `setStatusMessage("Streaming...")` in `handleChat()`
- `setIsIdle()` — when streaming completes or errors out

### 3. Config Schema (`src/config/schemas.js`)

Add to `MemorySchema`:

```javascript
gc: z.object({
  enabled: z.boolean().default(true),
  intervalMs: z.number().int().positive().default(30000),
  idleTimeoutMs: z.number().int().positive().default(10000),
  heapThreshold: z.number().min(0).max(1).default(0.8),
}).default({})
```

### 4. Dockerfile

Update the npm start command to include `--expose-gc`:

```dockerfile
cd /app && exec node --expose-gc index.js --mode interactive
```

## Design Decisions

### Why not `setInterval` during streaming?

GC is synchronous and pauses the event loop. Even a brief pause during streaming would manifest as stutter in the TUI. We only check conditions on the interval; the actual `global.gc()` call is gated behind the idle check.

### Why `heapUsed / heapTotal`?

`heapTotal` is the total heap size currently allocated by V8. `heapUsed` is what's actually in use. The ratio tells us heap efficiency. When high, V8 has allocated more than it needs — a prime candidate for GC.

### Why warn once and skip silently?

If `--expose-gc` isn't available, `global.gc` is `undefined`. We warn on first detection so the user knows the feature is inactive, then suppress further warnings.

### Why 30-second interval and 80% threshold?

Sensible defaults. Frequent enough to catch memory growth, infrequent enough to avoid overhead. Users can tune via config.

### Why not GC in CLI mode?

CLI is short-lived. GC benefits long-running processes. TUI is the primary long-running mode.
