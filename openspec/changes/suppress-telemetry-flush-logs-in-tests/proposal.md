## Why

The unit test `tests/unit/shutdown.test.js` deliberately throws a "flush failed" error to verify that `handleShutdown` suppresses telemetry flush errors gracefully. However, the `logger.error()` call inside `handleShutdown` produces the exact error message in test output, confusing users who see it during test runs or CI. The application code is correct — when telemetry is disabled, no flush occurs. The error is a test artifact, not a production issue.

## What Changes

- Mock `logger.error()` in the "suppresses telemetry flush errors" test so the error message no longer appears in test output
- No changes to application code — `handleShutdown` behavior remains identical
- No changes to telemetry logic — the app correctly skips flush when disabled

## Capabilities

### New Capabilities
<!-- None — this is a test-only fix -->

### Modified Capabilities
<!-- None — no spec-level behavior changes -->

## Impact

- `tests/unit/shutdown.test.js` — add logger mock to one test
- No production code changes
- No API or behavioral changes
