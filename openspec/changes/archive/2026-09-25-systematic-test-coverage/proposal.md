## Why

Current test coverage across the madz codebase is 68.49% line, 80.98% branch, and 53.73% functions — well below the 90% threshold enforced by the pre-commit hook. 118 files have no test file at all, and 14 files with existing tests are below 40% coverage. This creates fragility risk: untested code paths can hide regressions, and the coverage gate blocks legitimate changes.

## What Changes

- Systematically iterate through every source file with coverage below 90%, writing or extending unit tests until each file reaches 90% line coverage.
- Create test files for the 118 files that currently have no tests.
- Extend existing test files for the 14 files that have tests but are below 40% coverage.
- Mock external dependencies (Gmail API, Microsoft Graph, IMAP, OAuth) to enable testing of provider modules.
- Document untestable paths with `c8 ignore next` comments where code genuinely cannot be tested (e.g., requires live credentials).
- Update `coverage.txt` after each file reaches 90%.

## Capabilities

### New Capabilities
- `test-coverage-systematic`: Systematic per-file test coverage improvement targeting 90% line coverage across all source files.

### Modified Capabilities
<!-- No existing specs are changing — this is a testing infrastructure improvement, not a behavioral change. -->

## Impact

- **All source files** under `src/` will have corresponding test files in `tests/unit/`.
- **External service mocks** will be introduced for email (Gmail, Graph, IMAP) and calendar (Google, MS Graph) providers.
- **Coverage gates** will be satisfied, unblocking future development.
- **No behavioral changes** to production code — tests only.
