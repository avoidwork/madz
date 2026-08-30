## Context

The madz codebase has significant test coverage gaps in its most complex and frequently-used modules. The spreadsheet formula parser sits at 16.99% line coverage, email and calendar providers range from 18-28%, and several core utilities have no tests at all. The project uses `node --test` with c8 for coverage measurement, and the pre-commit hook runs lint + test + coverage. External dependencies (Gmail API, Microsoft Graph, IMAP) must be mocked in tests.

## Goals / Non-Goals

**Goals:**
- Achieve ≥90% line coverage for 14 priority files (spreadsheet, calendar, email provider modules)
- Create test files for 6 modules with no existing tests
- Mock all external service dependencies — no real API calls in tests
- Document untestable paths with `c8 ignore next` comments
- Verify each file reaches 90% before moving to the next

**Non-Goals:**
- Achieving 100% coverage — 90% is the target
- Adding integration tests — unit tests only
- Testing the TUI layer (Ink components)
- Testing the agent orchestration layer (DeepAgents/LangGraph)
- Testing Docker or deployment infrastructure

## Decisions

### Decision: Iterative per-file approach
**Choice:** Test one file at a time, verify 90% before moving to the next.
**Rationale:** This ensures each file is thoroughly covered before proceeding. It also makes it easy to identify which files are problematic and need special handling. The priority list from the issue audit provides a natural ordering from worst to best coverage.
**Alternatives considered:**
- Batch all tests at once: harder to verify per-file coverage, harder to debug failures
- Top-down approach (start with highest coverage): less impactful early wins

### Decision: Mocking strategy for external APIs
**Choice:** Use `node:test` mock module (`import { mock } from 'node:test'`) to mock external API clients.
**Rationale:** Node.js 24+ has built-in mock support. This avoids adding test dependencies and keeps tests fast and deterministic.
**Alternatives considered:**
- Sinon.js: adds dependency, already has Node.js native support
- Manual stubbing: more verbose, error-prone

### Decision: c8 ignore comments for untestable paths
**Choice:** Use `/* c8 ignore next */` comments to annotate lines that cannot be tested (e.g., code requiring live credentials).
**Rationale:** This is the standard c8 annotation format. It allows us to maintain 90% coverage while being honest about genuinely untestable paths.
**Alternatives considered:**
- Exclude entire files from coverage: loses visibility into testable code within those files
- Accept lower coverage: defeats the purpose of the initiative

### Decision: Test file structure
**Choice:** Mirror source structure — `src/tools/foo/bar.js` → `tests/unit/tools/foo/bar.test.js`.
**Rationale:** This is the established convention in the project (verified by existing test files). It makes it easy to find the test for any source file.

## Risks / Trade-offs

### Risk: Some files may not realistically reach 90%
**Mitigation:** Document untestable paths with `c8 ignore next` comments. If a file truly cannot reach 90% after thorough effort, note the reason and move on. The issue acknowledges this possibility.

### Risk: Test maintenance burden
**Mitigation:** Write focused, minimal tests that cover the specific code paths. Avoid over-engineering test fixtures. Each test should be a single assertion on a single behavior.

### Risk: External API mocking complexity
**Mitigation:** Study existing test files in the project (email, calendar tools) to understand the established mocking patterns. Reuse those patterns consistently.

### Risk: Time investment
**Mitigation:** Focus on the 20 files listed in the issue audit first. These provide the highest impact. The issue notes there are 118 files with no test file — those are out of scope for this PR.

## Migration Plan

This change is purely additive — new test files and test extensions. No migration plan is needed. The change is:
1. Create feature branch
2. Implement tests file by file
3. Commit and push
4. Create PR targeting main
5. Archive the OpenSpec change

## Open Questions

- Should we set a project-wide coverage threshold in package.json (e.g., `--test-coverage-threshold=90`)? This would enforce the 90% requirement going forward but is a separate change.
- Should we add a `.c8ignore` file to exclude files that are genuinely untestable from the overall coverage report?
