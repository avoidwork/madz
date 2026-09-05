## Context

The madz codebase has 68.49% line coverage, 80.98% branch coverage, and 53.73% function coverage. 118 files have no test file at all. 14 files with existing tests are below 40% coverage. The pre-commit hook enforces maintained coverage, so low coverage blocks development velocity.

Testing uses `node --test` (built-in Node.js test runner) with coverage via `--experimental-test-coverage`. Tests live in `tests/unit/` mirroring the `src/` structure. External services must be mocked — no real API calls.

## Goals / Non-Goals

**Goals:**
- Achieve ≥90% line coverage per source file across the entire `src/` directory.
- Create test files for all 118 files currently lacking tests.
- Extend existing test files for the 14 files below 40% coverage.
- Mock external dependencies (Gmail API, Microsoft Graph, IMAP, Google Calendar) to enable provider testing.
- Document untestable paths with `c8 ignore next` comments where code genuinely cannot be tested.

**Non-Goals:**
- No behavioral changes to production code — tests only.
- No integration or E2E tests (unit tests only).
- No changes to the test runner or coverage tooling configuration.
- No refactoring of source code for testability (beyond adding `c8 ignore` comments).

## Decisions

1. **Worst-first ordering**: Files sorted by coverage ascending (worst first) to maximize early impact. Spreadsheet module first (5 of 6 files < 40%), then email/calendar providers, then core infrastructure.

2. **Per-file iteration**: For each file, write/extend tests, run `npm run coverage`, verify the specific file reaches 90%, then commit before moving to the next. This prevents regressions from accumulating.

3. **Manual mocking over sinon**: Use Node.js built-in `mock` module (available in Node 24+) rather than sinon, to avoid additional dependencies. Manual mock functions for Gmail API, Microsoft Graph, IMAP connections.

4. **`c8 ignore next` for untestable paths**: Code paths requiring live credentials, OS-level behavior, or process signals that cannot be mocked will be annotated with `/* c8 ignore next */` and documented in the test file.

## Risks / Trade-offs

- **Mock fidelity risk**: Mocked API responses may diverge from real API behavior. Mitigation: mock at the provider interface boundary, not the HTTP level.
- **Time cost**: 118 files with no tests + 14 files below 40% = significant effort. Mitigation: worst-first ordering ensures biggest coverage gains early.
- **Flaky coverage metrics**: `--experimental-test-coverage` may produce slightly different results across runs. Mitigation: target 90% with a 2% buffer (aim for 92%).
- **Process signal testing**: `process.on('SIGTERM')` handlers are difficult to test without forking. Mitigation: extract handler logic into testable functions, keep the `process.on` registration minimal.
