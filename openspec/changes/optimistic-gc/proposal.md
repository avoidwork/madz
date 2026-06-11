# Proposal: Optimistic Garbage Collection

## Why

The V8 engine's garbage collector runs automatically, but under sustained memory pressure — especially with the memory system writing files, loading context, and maintaining session state — V8 may not collect aggressively enough before heap usage becomes problematic. An **optimistic GC** gives us proactive control: we trigger V8's collector during idle periods and when heap usage crosses a threshold, keeping memory footprint lean without manual intervention.

## What

Add an optional, timer-driven garbage collection mechanism that:

- Calls `global.gc()` (V8's internal GC) when conditions are met
- Triggers during TUI idle periods (no active streaming/conversation)
- Triggers when heap usage reaches 80% of total heap size
- Runs on a configurable interval (default: 30 seconds)
- Degrades gracefully when `--expose-gc` is not available

## Scope

| In Scope                                      | Out of Scope                             |
|-----------------------------------------------|------------------------------------------|
| `src/memory/gc.js` — GC manager module        | Modifying V8 internals or GC algorithms  |
| Config schema for `memory.gc` settings        | GC for sandboxed child processes         |
| TUI idle detection integration                | Memory profiling or leak detection       |
| Dockerfile `--expose-gc` flag                 | CLI mode GC (interactive only)           |
| Unit tests                                    |                                          |

## Config

New config section under `memory`:

```yaml
memory:
  gc:
    enabled: true
    intervalMs: 30000
    idleTimeoutMs: 10000
    heapThreshold: 0.8
```

- `enabled` — Toggle GC on/off (default: `true`)
- `intervalMs` — How often to check conditions (default: 30s)
- `idleTimeoutMs` — Minimum idle time before GC fires (default: 10s)
- `heapThreshold` — Heap usage ratio that triggers GC (default: 0.8 = 80%)

## Impact

- **TUI responsiveness**: GC only fires when idle + streaming is off. No visible impact.
- **Memory footprint**: Proactive collection keeps heap usage lower over time.
- **Docker**: Requires `--expose-gc` Node.js flag in the runtime command.
