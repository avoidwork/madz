# Proposal

## Why

The codebase has two coexisting conventions for handling failures. Most catch blocks log via the structured `logger` singleton, but a meaningful minority swallow errors silently — either with `catch (_err) { return ...; }` or `.catch(() => {})`. Silent failures lose diagnostic signal: when a file cannot be read, a URL fails to parse, or a JSON body is malformed, the application proceeds as if nothing happened and the operator has no record of why. This makes production issues hard to trace.

## What Changes

- Standardize on the structured `logger` singleton (`src/shared/logger.js`) for all catch-block logging, using the appropriate level (`error`, `warn`, or `debug`).
- Fix silent catch sites: `src/vector/chunker.js`, `src/sandbox/urlFilter.js`, `src/tools/webhook/index.js`, and the other listed tools/modules — either log the error or add an explicit comment documenting why the swallow is intentional.
- Document intentional swallows (e.g., `src/stream/loopDetector.js` "failed check must never break streaming", the `src/vector/indexerWorker.js` serialization queue, response-body read fallbacks).
- Resolve the `logError(err, context)` helper ambiguity: it is currently exported but used only within `src/shared/logger.js` itself. Promote it as the standard catch-block logger or deprecate it — one convention, not two.
- Preserve the never-throw invariant: logging must never itself crash the application.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `error-logging`: Extend the existing requirement that all catch blocks log errors to explicitly cover silent `catch (_err)` and `.catch(() => {})` sites, and to require that intentional swallows be documented rather than silently discarded.

## Impact

- **Code**: `src/vector/chunker.js`, `src/sandbox/urlFilter.js`, `src/tools/webhook/index.js`, and other modules with silent catch sites.
- **Logger**: `src/shared/logger.js` — resolve `logError` helper usage.
- **Tests**: Add unit tests asserting failures are logged (mock `logger` and assert calls) for changed modules.
- **No breaking changes** to public behavior — errors previously swallowed are still handled gracefully, now with logging.

## Non-goals

- Not introducing a new logging abstraction (YAGNI — the existing `logger` singleton suffices).
- Not changing the log sink, format, or PII redaction behavior.
- Not altering the never-throw invariant of the logger.
