## Context

The logger module (`src/logger.js`) handles application logging with OS-aware directory detection and dual-file output. It has two critical issues:

1. **TOCTOU Race Condition**: In `getLogDirectory()`, Alpine Linux detection uses `existsSync()` followed by `readFileSync()` without error handling. If `/etc/alpine-release` is deleted between these calls, an uncaught exception crashes the application at startup.

2. **Redundant Stream Creation**: When both primary log streams fail (info and error), the code creates two separate `/dev/null` streams instead of reusing a single one, wasting file descriptors.

The existing `system-logger` spec defines requirements for OS-aware directory detection and graceful fallback, but the implementation doesn't fully satisfy these requirements in edge cases.

## Goals / Non-Goals

**Goals:**
- Eliminate the TOCTOU race condition in Alpine Linux detection
- Reduce redundant `/dev/null` stream creation to a single stream
- Add unit tests to verify the fixes
- Review pino multistream usage for forward compatibility

**Non-Goals:**
- Refactor the entire logging architecture
- Change the log format or output structure
- Add new logging capabilities or features
- Migrate to a different logging library

## Decisions

### Decision 1: Wrap `readFileSync` in try/catch instead of using `fs.promises.access()`

**Rationale**: The simplest fix is to wrap the `readFileSync()` call in a try/catch block. If the file cannot be read (deleted, permission denied, etc.), the function falls through to the default Linux path. This maintains backward compatibility and doesn't introduce async code into a synchronous function.

**Alternatives considered:**
- `fs.promises.access()`: Would require making `getLogDirectory()` async, which is a breaking change
- `tryStatSync()`: Not available in Node.js standard library
- Remove Alpine detection entirely: Loses the ability to use `~/.cache/madz/logs/` on Alpine systems

### Decision 2: Hoist `devNull` variable to function scope for reuse

**Rationale**: The `devNull` variable is hoisted to function scope so it can be accessed by both try/catch blocks. When `infoStream` fails and creates `devNull`, the error stream fallback checks if `devNull` exists and reuses it instead of creating a second stream.

**Alternatives considered:**
- Create a shared `getDevNullStream()` function: Adds complexity for a simple fix
- Use a singleton pattern: Over-engineering for this use case
- Accept the redundant streams: Wastes file descriptors, doesn't fix the issue

### Decision 3: Review pino multistream before migrating

**Rationale**: The issue mentions that `pino.multistream` may be deprecated in newer Pino versions. However, this is a forward-looking concern, not an immediate bug. The fix should focus on the TOCTOU race condition and redundant streams first, then review the pino version and migration path separately.

**Alternatives considered:**
- Migrate immediately to `pino.destination()`: Unnecessary complexity if multistream is not yet deprecated
- Add a TODO comment: Doesn't address the potential deprecation
- Ignore the issue: Risks future breakage when pino updates

## Risks / Trade-offs

### Risk 1: try/catch adds minimal overhead
**Mitigation**: The try/catch only wraps a single `readFileSync()` call that executes once at startup. The overhead is negligible.

### Risk 2: Fallback to default Linux path on Alpine
**Mitigation**: If Alpine detection fails, the function falls back to `~/.local/share/madz/logs/` which is the standard Linux path. This is a reasonable fallback that ensures the application starts, even if logs are stored in a non-standard location on Alpine systems.

### Risk 3: Stream reuse may affect logging behavior
**Mitigation**: The `devNull` stream is used only when both primary streams fail. In this case, both info and error logs are discarded anyway, so reusing the same stream doesn't change the observable behavior.

### Risk 4: Tests may be non-deterministic for race condition
**Mitigation**: Use the existing subprocess test approach to simulate file system operations deterministically. The test creates a file, imports the logger, deletes the file, and verifies no exception is thrown.

## Migration Plan

This is a bug fix with no migration required. The changes are:
1. Update `src/logger.js` with the fixes
2. Add new tests to `tests/unit/logger.test.js`
3. Run the existing test suite to verify no regressions

Rollback strategy: Revert the commit if any issues are discovered.

## Open Questions

1. **Pino version**: What version of pino is currently installed, and is `multistream` actually deprecated?
2. **Alpine detection frequency**: How often is `getLogDirectory()` called? If it's called multiple times, should the Alpine detection result be cached?