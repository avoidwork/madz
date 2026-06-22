## Why

The application depends on pino `^10.3.1`, but `src/logger.js` still calls `pino.multistream()`, an API that was removed in pino v10. This causes a `TypeError` at startup: "pino.multistream is not a function." The audit-code skill flagged this as a high-severity bug. The fix is straightforward — migrate to the v10-compatible array-based destination API — but it must be done before the application can start.

## What Changes

- Replace `pino.multistream(streams)` with the v10 array-based destination API in `src/logger.js`
- Remove the deprecated TODO comment about multistream deprecation
- No changes to log format, log directory detection, or the exported logger interface
- Level routing behavior shifts slightly: error/fatal logs write to `madz_error.log` only (not both files), which is the more correct behavior for a dedicated error log

## Capabilities

### New Capabilities
<!-- None — this is a compatibility fix, not a new capability -->

### Modified Capabilities
<!-- No spec-level requirement changes — only implementation update -->

## Impact

- **Affected code:** `src/logger.js` (single file, single function call change)
- **Dependencies:** pino v10.3.1 (already installed, no version change)
- **Behavioral change:** Error logs no longer duplicate into `madz.log` — they write only to `madz_error.log`. This is a correction, not a regression.
- **Risk:** Low. The change is a drop-in API replacement with existing error handling and fallback logic preserved.