## Why

The madz codebase has significant test coverage gaps in critical tool modules. The spreadsheet parser (formulaParser.js) sits at 16.99% line coverage, calendar and email providers range from 18-28%, and several core utilities have no tests at all. This leaves the most complex and frequently-used code paths unverified, increasing the risk of regressions and making refactoring dangerous. Achieving 90% line coverage per file ensures each module is thoroughly tested before changes are made to it.

## What Changes

- Write or extend unit tests for 14 priority files with the lowest coverage (spreadsheet, calendar, email provider modules)
- Create new test files for 6 files with no existing tests (scheduler/cron, session/shutdown, shared/logger, skills/registry, tools/yaml, tools/webhook)
- Target ≥90% line coverage per file using c8 via `npm run coverage`
- Mock all external dependencies (Gmail API, Microsoft Graph, IMAP) — no real API calls in tests
- Document untestable paths with `c8 ignore next` comments where live credentials or hardware are required
- Verify each file reaches 90% before moving to the next

## Capabilities

### New Capabilities

- `test-coverage`: Define test coverage requirements and verification procedures for all source files in the madz codebase

### Modified Capabilities

- None — no existing spec requirements are changing

## Impact

- **Affected code:** src/tools/spreadsheet/, src/tools/calendar/, src/tools/email/providers/, src/tools/compactContext/, src/scheduler/, src/session/, src/shared/, src/skills/, src/tools/yaml/, src/tools/webhook/
- **Affected tests:** tests/unit/tools/spreadsheet/, tests/unit/tools/calendar/, tests/unit/tools/email/, tests/unit/tools/compactContext/, tests/unit/scheduler/, tests/unit/session/, tests/unit/shared/, tests/unit/skills/, tests/unit/tools/yaml/, tests/unit/tools/webhook/
- **Dependencies:** No new dependencies — uses existing `node --test` and c8 coverage
- **Systems:** Testing pipeline only — no runtime behavior changes

## Non-goals

- Achieving 100% coverage — 90% is the target; some paths are genuinely untestable
- Adding integration tests — this effort is unit tests only
- Testing the TUI layer — Ink-based components are out of scope
- Testing the agent orchestration layer — DeepAgents and LangGraph integration is out of scope
- Testing Docker or deployment infrastructure
