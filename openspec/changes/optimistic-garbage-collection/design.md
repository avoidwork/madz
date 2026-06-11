## Context

The Madz TUI maintains a `messages` array that grows unboundedly during a session. Each message contains full text content, reasoning content, tool call displays, and timestamps. Similarly, `sessionState.conversation` accumulates every exchange. Memory context entries in `memory/context/` can also grow without bound. The only existing trimming is `enforceContextWindow` which operates on conversation history sent to the LLM — but the TUI display state and persisted state retain everything.

In containerized deployments with tight memory limits (e.g., 256MB), a session with 200+ exchanges producing large AI responses (especially with tool outputs or reasoning content) can push the V8 heap toward its limit. The Node.js default heap is ~1.4GB but Docker containers often cap much lower.

## Goals / Non-Goals

**Goals:**
- Prevent OOM kills during long-running sessions by proactively trimming in-memory data structures
- Provide configurable thresholds so users can tune the trade-off between history depth and memory usage
- Keep the mechanism non-intrusive — trimming happens during idle periods and after exchanges, not blocking user input
- Maintain display continuity — trimmed messages are still accessible via session file reload

**Non-Goals:**
- Changing the LLM context window mechanism (existing `enforceContextWindow` stays as-is)
- Implementing a full memory profiler or monitoring system
- Adding persistent compaction of session files (that's a "coming soon" feature)
- Trimming reasoning content beyond what's already in the messages array

## Decisions

### 1. Trim TUI messages to a configurable window (default: 100)
**Rationale**: The TUI only renders the visible viewport (~20-30 messages). Keeping 100 messages in memory provides comfortable scrollback without wasting heap. This is a display concern, not a conversation concern — the full history is already persisted to `memory/sessions/`.

**Alternatives considered:**
- Keep all messages: Rejected — unbounded growth is the root problem
- Trim to viewport size: Rejected — too aggressive, users lose scrollback context
- Trim to 50: Rejected — 100 provides better UX for review without significant memory cost

### 2. Enforce max memory context entries (default: 100)
**Rationale**: The `loadMemories` function reads ALL `.md` files from `memory/context/` into memory on every dispatch. With hundreds of entries, this creates a large concatenated string for the system prompt. The existing `enforceMaxEntries` in `retention.js` already has the logic — we just need to wire it up with a sensible default.

**Alternatives considered:**
- Age-based only: Rejected — a user could write 500 short entries and still hit memory limits
- Count + age: Rejected for now — count-based alone is sufficient; age-based already exists via `cleanRetainedMemory`

### 3. Use `queueMicrotask` for non-blocking collection
**Rationale**: GC should never block the event loop or delay user-visible operations. `queueMicrotask` schedules cleanup after the current synchronous work completes, making it non-blocking.

**Alternatives considered:**
- `setTimeout`: Adds unnecessary delay and complexity
- Synchronous trimming: Blocks the event loop, degrades UX

### 4. Trigger GC after each exchange and on TUI idle
**Rationale**: After each exchange, we know the messages array just grew. After idle, we catch up on anything deferred. This two-trigger approach keeps memory bounded without constant polling.

**Alternatives considered:**
- Timer-based only: Misses exchanges that happen during rapid input
- Manual only: Users won't remember to run it

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Users lose scrollback history in TUI | Full history is persisted to `memory/sessions/` and reloadable via `:session restore` or restart |
| GC trims too aggressively | Configurable thresholds; defaults are conservative (100 messages, 100 entries) |
| GC introduces latency spikes | Uses `queueMicrotask` for non-blocking execution; trimming 100 items is negligible |
| Memory context entries are permanently removed | Oldest entries are deleted from disk; users can recover from git if needed |

## Migration Plan

1. Add `memory.gc` config section to `config.yaml` with defaults
2. Implement `gcCollect()` utility — no behavior change until wired up
3. Wire GC triggers into TUI app (after exchange, on idle)
4. Add `:gc` TUI command for manual trigger
5. Update `memory-system` spec with GC requirements
6. Add tests for GC utility and TUI integration

No rollback concerns — this is additive. If GC causes issues, thresholds can be raised or the feature disabled via config.

## Open Questions

1. Should GC also trim the `chatHistory` array in the TUI? Currently it only stores non-empty user input lines — unlikely to be a problem, but worth monitoring.
2. Should we expose a `:gc status` subcommand to show current memory usage (message count, entry count, estimated heap)?
