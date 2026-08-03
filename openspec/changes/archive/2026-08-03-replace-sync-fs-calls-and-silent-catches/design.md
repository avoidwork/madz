## Context

The src/ audit (issue #683) identified two categories of violations against AGENTS.md §1.1:
1. Synchronous fs operations in async contexts that block the Node.js event loop
2. Bare silent catch blocks that swallow errors without logging

These violations exist across 25+ files in the codebase. The codebase uses Node.js 24+ with ESM, and the existing pattern for async fs operations is well-established in many files (e.g., `src/tools/session_search.js`, `src/tools/sampling.js`, `src/scheduler/cron.js`).

## Goals / Non-Goals

**Goals:**
- Convert all sync fs calls in async contexts to async equivalents from `node:fs/promises`
- Replace all bare `catch {}` blocks with proper error logging via the existing `logger` singleton
- Preserve existing function signatures, return types, and error handling semantics
- Maintain backward compatibility — no breaking changes to public APIs

**Non-Goals:**
- Converting module-level sync fs calls in `config/loader.js` and `logger.js` (synchronous initialization)
- Adding new error handling libraries or frameworks
- Changing the behavior of error recovery — only adding logging
- Converting sync fs calls in files that are definitively only called from sync contexts

## Decisions

### Decision 1: Use `node:fs/promises` instead of `util.promisify`

**Choice:** Import `readFile`, `writeFile`, `readdir`, `stat`, `access`, `mkdir`, `unlink` from `node:fs/promises` directly.

**Rationale:** This is the existing pattern throughout the codebase (e.g., `src/tools/session_search.js`, `src/tools/sampling.js`, `src/scheduler/cron.js`). It's cleaner than `util.promisify` and more readable.

**Alternatives considered:**
- `util.promisify(fs.readFileSync)` — adds indirection, not used elsewhere in the codebase
- Third-party promise libraries — unnecessary dependency

### Decision 2: Error logging severity levels

**Choice:** Use `logger.debug()` for expected/non-critical failures (file not found, directory doesn't exist, YAML parse errors during discovery) and `logger.error()` for unexpected/critical failures (schedule execution failures, context load failures).

**Rationale:** The existing `logger` singleton from `src/logger.js` provides structured JSON logging. Using `debug` for expected failures avoids log noise while still providing visibility. Using `error` for unexpected failures ensures they surface in monitoring.

**Alternatives considered:**
- Always use `logger.error()` — creates log noise for expected failures
- Always use `logger.warn()` — doesn't distinguish between expected and unexpected failures
- Re-throw all errors — would break existing error handling patterns in callers

### Decision 3: Preserve sync fs in module-level initialization

**Choice:** Leave `readFileSync` in `config/loader.js` and `logger.js` as-is.

**Rationale:** These files are imported at module level and called synchronously during application startup. Converting them would require restructuring the entire initialization flow, which is out of scope for this fix.

**Alternatives considered:**
- Convert to async and make initialization async — would require changes to `index.js` and all subsystems
- Leave as-is with a comment explaining why — acceptable for now, could be addressed in a future refactor

### Decision 4: Handle `existsSync` → `access`

**Choice:** Replace `existsSync(path)` with `access(path, constants.F_OK)` from `node:fs/promises`, wrapped in try/catch.

**Rationale:** `access` is the async equivalent of `existsSync`. It throws if the file doesn't exist, so callers need to handle the error. This is consistent with existing patterns in the codebase (e.g., `src/tools/session_search.js:17`).

**Alternatives considered:**
- `stat` — more information than needed, slightly slower
- `readFile` — overkill for existence check

## Risks / Trade-offs

### Risk 1: Performance regression in hot paths

**Impact:** Async fs operations have slightly higher overhead than sync operations due to the event loop scheduling.

**Mitigation:** The affected functions are not in hot paths — they are called during session loading, skill discovery, and prompt loading, which are infrequent operations. The performance difference is negligible.

### Risk 2: Test failures due to async changes

**Impact:** Tests that mock sync fs calls may need to be updated to mock async fs calls.

**Mitigation:** Review test files for affected functions and update mocks to return promises. The existing test patterns in the codebase already use async mocks (e.g., `src/tools/session_search.test.js`).

### Risk 3: Silent catch replacement changes behavior

**Impact:** Replacing `catch {}` with `catch (err) { logger.debug(...) }` will add log output where there was none before.

**Mitigation:** This is the intended behavior — silent catches are a bug. The debug-level logging ensures visibility without noise. Tests that verify no log output may need adjustment.

## Migration Plan

1. Convert sync fs calls to async in each file (10 files)
2. Replace bare catch blocks with proper error handling (25+ files)
3. Run `npm run test` to verify all tests pass
4. Run `npm run lint` to verify linting passes
5. Run `npm run coverage` to verify coverage is maintained
6. Commit and push to the feature branch

## Open Questions

- None — all affected files have been identified and the approach is clear.
