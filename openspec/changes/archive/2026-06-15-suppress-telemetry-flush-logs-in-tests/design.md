## Context

The `handleShutdown` function in `src/session/shutdown.js` catches telemetry flush errors and logs them via `logger.error()`. The unit test `tests/unit/shutdown.test.js` deliberately throws a "flush failed" error to verify that `handleShutdown` suppresses the exception (doesn't re-throw). The `logger.error()` call produces the exact error message in test output, confusing users.

## Goals / Non-Goals

**Goals:**
- Suppress `logger.error()` output in the "suppresses telemetry flush errors" test
- Keep the test's verification intact (asserts no throw)
- No changes to application code

**Non-Goals:**
- Changing `handleShutdown` behavior
- Adding new test infrastructure
- Modifying other tests

## Decisions

1. **Use Node.js test runner `mock.module()`** — This is the built-in mocking mechanism for Node.js test runner. It allows us to mock the `logger` module's `error` method before importing `handleShutdown` in the test.

2. **Scope mock to specific test** — The mock is created inside the specific test case, not at the describe level, to prevent leakage to other tests.

3. **No-op mock** — The mock function does nothing (`() => {}`), since the test only verifies that no exception is thrown, not that the log message is correct.

## Risks / Trade-offs

- **Mock leakage:** If not scoped correctly, the mock could affect other tests. Mitigation: create mock inside the test body, not at describe level.
- **Reduced test observability:** We lose visibility into the error log during this test. Acceptable because the test verifies behavior (no throw), not log content.

## Migration Plan

N/A — this is a test-only change with no deployment impact.

## Open Questions

None.
