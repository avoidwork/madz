## Context

`src/shared/logger.js` is the structured logging module for the madz application. It uses `pino` with a dual-file multistream setup (`madz.log` for info/warn/debug, `madz_error.log` for error/fatal). The module contains 11 bare `catch {}` blocks that silently discard errors. These fall into two categories:

1. **Module-initialization guards** (around `createWriteStream` and `mkdirSync`): defensive guards that fall back to `/dev/null` or `os.tmpdir()` when the log directory is unwritable. A logger must never throw during initialization.
2. **Logger-method guards** (inside `info`, `warn`, `error`, `debug`, `fatal`): defensive guards that silently discard if pino throws. A logger must never throw when a caller invokes a log method.

AGENTS.md §1.1 strictly prohibits empty/silent catch blocks. The fix must bind the error and log it (at least at debug level) so failures are observable, while preserving the never-throw invariant.

## Goals / Non-Goals

**Goals:**
- Convert all 11 bare `catch {}` blocks in `src/shared/logger.js` to error-bound `catch (err) { ... }` blocks
- Log the bound error at an appropriate level (`debug` for expected fallback failures, `error` for unexpected failures)
- Preserve the logger's never-throw invariant — a logging failure must never propagate
- Maintain existing behavior: fallback to `/dev/null`, silent mode in tests, dual-file output

**Non-Goals:**
- Modifying other files in the repo that may contain silent catch blocks
- Changing the logger's API, log routing, or log levels
- Adding new error-handling frameworks or libraries
- Changing what gets caught — only adding logging to existing catch blocks

## Decisions

### Decision 1: Logging level mapping

**Choice:** Use `logger.debug()` for expected/non-critical fallback failures (stream creation, directory creation) and `logger.error()` for unexpected failures.

**Rationale:** This matches the established `error-logging` spec capability and the prior `replace-sync-fs-calls-and-silent-catches` change. Expected failures (unwritable directory, stream open failure) are non-critical and would otherwise create log noise at `error` level. Unexpected failures (a pino call throwing) warrant `error` level.

**Alternatives considered:**
- Always `logger.error()` — creates log noise for expected fallback failures
- Always `logger.warn()` — doesn't distinguish expected vs unexpected
- Re-throw — would break the never-throw invariant

### Decision 2: Avoid recursion in logger-method catch blocks

**Choice:** The catch blocks inside the `logger` object's methods (`info`, `warn`, `error`, `debug`, `fatal`) must NOT re-invoke the `logger` singleton to log the error, because that would recurse (a failed log call triggers the catch, which logs, which fails again). Instead, they log via a safe, non-recursive fallback — a guarded `console.error` call.

**Rationale:** The logger methods are the boundary where a pino failure is caught. Re-invoking `logger.error()` from within `logger.error()`'s catch block would cause infinite recursion if pino is persistently failing. A guarded `console.error` provides observability without recursion risk.

**Alternatives considered:**
- Re-invoke `logger` — infinite recursion risk
- Call `pinoLogger` directly — `pinoLogger` may be undefined or in silent mode; also could throw again
- `console.error` guarded — safe, non-recursive, always available

### Decision 3: Module-initialization catch blocks log via logger

**Choice:** The module-initialization catch blocks (around `createWriteStream` and `mkdirSync`) log via the `logger` singleton where it is safe to do so.

**Rationale:** These run during module initialization. The `logger` singleton is defined later in the module, so the catch blocks that run before `logger` is defined (e.g., in `tryCreateDirectory` and the stream-creation block) must use a safe fallback. The catch blocks that run after `logger` is defined can use it. To keep it simple and safe, all module-init catch blocks will use a guarded fallback (a module-level `logError` helper that uses `console.error` if `logger` is not yet available, otherwise `logger.debug`).

**Alternatives considered:**
- Use `logger` everywhere — `logger` may not be defined yet during early module init
- `console.error` everywhere — loses structured logging for post-init failures

### Decision 4: Preserve `node:coverage disable` comments

**Choice:** Keep the `/* node:coverage disable */` and `/* node:coverage enable */` comments wrapping the defensive catch blocks.

**Rationale:** These mark code paths that require unwritable filesystems or throwing pino instances to exercise. Removing them would cause coverage regressions.

## Risks / Trade-offs

### Risk 1: Logging failure could propagate
**Impact:** If the logging call inside a catch block throws, it could propagate and break the never-throw invariant.
**Mitigation:** All logging calls inside catch blocks are wrapped in their own try/catch or use a guarded fallback (`console.error`) that cannot throw.

### Risk 2: Infinite recursion
**Impact:** Re-invoking the `logger` singleton from within a logger-method catch block could cause infinite recursion.
**Mitigation:** Logger-method catch blocks use a guarded `console.error` fallback, never re-invoking the `logger` singleton.

### Risk 3: Coverage regression
**Impact:** The `node:coverage disable` comments must be preserved or coverage drops.
**Mitigation:** Keep the `/* node:coverage disable */` / `/* node:coverage enable */` wrappers intact.

### Risk 4: Test failures
**Impact:** Existing logger tests may assert on silent behavior.
**Mitigation:** Review `tests/unit/logger.test.js` and add tests verifying catch blocks bind and log errors without throwing.

## Migration Plan

No deployment steps required — this is a source-code fix. Rollback is a revert of the single-file change.

## Open Questions

None.
