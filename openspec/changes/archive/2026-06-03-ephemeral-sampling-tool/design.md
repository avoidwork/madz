## Context

The agent lacks a mechanism to capture ephemeral emotional or reinforcement signals during a session. The existing `memory` tool (in `src/tools/memory.js`) writes persistent key-value entries to `memory/context/` but has no concept of temporary, self-expiring memories. The agent runs in high-intensity moments (joy, grief, strong memory reinforcement) without a way to record these transient signals for later sessions.

Current state:
- `memory/context/` holds user-provided context notes permanently
- `src/memory/writer.js` writes timestamped markdown files
- No TTL or expiration mechanism exists for any memory type
- No rate limiting or capacity limits on context file writes
- The `loadContext()` function reads all `.md` files from `memory/context/` indiscriminately

## Goals / Non-Goals

**Goals:**
- Sampling tool that writes ephemeral memories to `memory/context/` with `ephemeral: true` frontmatter
- Session-init cleanup that asynchronously deletes expired ephemeral memories
- Rate limiting: 1 ephemeral memory per 60-minute period
- Capacity limit: max N ephemeral memories (configurable, default 10)
- Configurable TTL (default 7 days) and max entries via `config.yaml` `memory.ephemeral` section

**Non-Goals:**
- Modifying the existing `memory` tool's persistent entry behavior
- Real-time (non-session-init) cleanup
- User-facing UI for ephemeral memory management
- Timezone-specific midnight calculation beyond system timezone
- Migration of existing context files to ephemeral format

## Decisions

### 1. Ephemeral memories live alongside regular context files in `memory/context/`

Ephemeral files are standard `.md` files with `ephemeral: true` in frontmatter, stored in the same `memory/context/` directory. The `sampling` tool writes to this directory via `writeMemoryFile()`. On session init, expired ephemeral files are filtered out.

**Rationale**: Consistent with the existing file-based memory architecture. No new directory needed. The `ephemeral` frontmatter key distinguishes them from persistent files.

### 2. Rate limiting uses a simple timestamp check per session

The sampling tool's implementation maintains a `lastWritten` timestamp in its closure. On each call, it checks if 60 minutes have elapsed since `lastWritten`. If not, it returns a rejection/error indicating the cooldown is active.

**Rationale**: No external state needed. The agent calls the tool, gets feedback immediately if rate limited. Closure-based tracking is consistent with the existing tool factory pattern (`buildToolConfig` passes runtime options via closure).

### 3. Capacity limit checks current file count in `memory/context/`

Before writing, the sampling tool counts files matching `ephemeral: true` prefix pattern. If count >= maxEntries, it returns an error.

**Rationale**: Simple file-system-based count. No index or database needed. Consistent with `memory.js` approach of counting `.md` files using `readdir()`.

### 4. Expiration calculation rounds to next midnight in system timezone

Expiration is `createdDate + ttlDays`, rounded up to the next midnight (00:00:00) in the system's local timezone. This means a file created at 23:59 on day 0 expires at midnight on day 6 (6 days later effectively), while one created at 00:01 on day 0 expires at midnight on day 7.

Format: `ephemeral_expiresAt: "2026-06-09T00:00:00"`

**Rationale**: Midnight-based expiry simplifies the cleanup logic -- all expired files at any given time share the same reference date. System timezone is used since no user-configurable timezone is in scope.

### 5. Cleanup runs asynchronously via `queueMicrotask()` at session init

The cleanup is triggered during session setup in `index.js` (after config and session create), before the first request. It uses `queueMicrotask()` to schedule the cleanup without blocking the agent startup. The cleanup reads all `.md` files in `memory/context/`, filters for `ephemeral: true` with `expiresAt` before now, and unlinks them.

**Rationale**: Non-blocking as required. `queueMicrotask()` schedules after the current operation completes but before I/O callbacks, avoiding delay to session startup. Cleanup is fire-and-forget -- errors are swallowed to prevent session crashes.

### 6. `memory.ephemeral` config added to existing `MemorySchema`

The config schema is extended with a nested `ephemeral` object containing `ttlDays` (default 7) and `maxEntries` (default 10). These values are passed through runtime options to the sampling tool and the cleanup function.

**Rationale**: Consistent with the config pattern (`memory.directory`, `memory.contextDir` etc.). Keeps ephemeral settings grouped and discoverable.

## Risks / Trade-offs

### [Risk] Race condition between sampling writes during cleanup
During cleanup, new ephemeral files could be written or removed concurrently. The cleanup reads file list once, then checks each file's existence before unlinking.

**Mitigation**: Cleanup runs once at session init before any user interaction. No rate-limited writes can occur simultaneously (rate limit is per-session).

### [Risk] Existing context files without `ephemeral: true` are unaffected
The cleanup only deletes files with `ephemeral: true` frontmatter. Existing context files are safe.

**Mitigation**: Explicit frontmatter check before deletion. Files without frontmatter or with `ephemeral: false` are never touched.

### [Risk] Midnight alignment may cause files to "live" longer than TTL
A file created at 00:01 on day 0 with ttlDays=7 lives until midnight of day 7, which is 6 days and 23 hours 59 minutes 59 seconds -- effectively 1 minute short of 7 full days.

**Acceptable trade-off**: Simpler than per-file midnight calculation. The difference is at most 1 day for the 7-day TTL.

### [Risk] No mechanism to write multiple ephemeral memories within 60 minutes
The strict cooldown means high-intensity moments that occur close together can only be sampled once.

**Mitigation**: This is by design per the spec. The agent should use the existing `memory` tool for additional persistent entries during the cooldown period.

## Migration Plan

No migration needed. This introduces new functionality without modifying existing behavior:

1. New config keys in `memory.ephemeral` merge with existing `memory.*` keys via deep merge
2. Existing `memory/context/` files are read by `loadContext()` and unaffected by new cleanup
3. Cleanup only targets `ephemeral: true` files, never overwrites or deletes others
4. Sampling tool is opt-in via agent prompting (not auto-triggered)
