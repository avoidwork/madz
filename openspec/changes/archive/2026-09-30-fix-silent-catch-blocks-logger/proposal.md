## Why

The `src/shared/logger.js` module contains 11 bare `catch {}` blocks that silently discard errors with no error binding and no logging. This violates AGENTS.md §1.1, which strictly prohibits empty/silent catch blocks. These are defensive guards around file-stream creation and pino logging calls — a logger must never throw — but they must bind the error and log it (at least at debug level) so failures are observable.

## What Changes

- Convert all 11 bare `catch {}` blocks in `src/shared/logger.js` to `catch (err) { ... }` with error binding
- Log the bound error at an appropriate level: `debug` for expected/non-critical fallback failures (stream creation, directory creation), `error` for unexpected failures
- Preserve the logger's never-throw invariant — logging within catch blocks is itself guarded to prevent recursion and ensure a logging failure never propagates
- No API changes, no new dependencies, no change to log routing or log levels

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `error-logging`: The existing capability that requires all catch blocks to log errors via the structured logger. This change extends it to cover the logger module's own defensive catch blocks, which must bind and log errors (at least at debug level) rather than silently discarding them, while preserving the never-throw invariant.

## Impact

- **Affected files**: `src/shared/logger.js` — all 11 bare `catch {}` blocks converted to error-bound, logging catch blocks
- **APIs**: No breaking changes — function signatures and return types remain identical
- **Dependencies**: No new dependencies — uses existing `pino` import and the module's own logger
- **Tests**: Existing logger tests must continue to pass; new tests added to verify catch blocks bind and log errors without throwing

## Non-goals

- Modifying other files in the repo that may contain silent catch blocks (out of scope for this issue)
- Changing the logger's API, log routing, or log levels
- Adding new error-handling frameworks or libraries
- Changing what gets caught — only adding logging to existing catch blocks
