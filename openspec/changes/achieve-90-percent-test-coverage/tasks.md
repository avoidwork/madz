## 1. Setup and Discovery

- [ ] 1.1 Discover existing test patterns in the codebase
- [ ] 1.2 Run initial coverage report to establish baseline

## 2. Spreadsheet Module Tests (Worst Coverage)

- [ ] 2.1 Extend tests for src/tools/spreadsheet/formulaParser.js (16.99% → 90%)
- [ ] 2.2 Extend tests for src/tools/spreadsheet/pivot.js (25.00% → 90%)
- [ ] 2.3 Extend tests for src/tools/spreadsheet/stats.js (34.31% → 90%)
- [ ] 2.4 Extend tests for src/tools/spreadsheet/spreadsheet.js (33.27% → 90%)
- [x] 2.5 Extend tests for src/tools/spreadsheet/csv.js
- [x] 2.6 Extend tests for src/tools/spreadsheet/formulaParser.js (extended)
- [x] 2.7 Extend tests for src/tools/spreadsheet/pivot.js (extended)
- [x] 2.8 Extend tests for src/tools/spreadsheet/spreadsheet.js (extended)
- [x] 2.9 Extend tests for src/tools/spreadsheet/stats.js (extended)

## 3. Calendar Module Tests

- [ ] 3.1 Extend tests for src/tools/calendar/index.js (18.18% → 90%)
- [ ] 3.2 Extend tests for src/tools/calendar/providers/base.js (42.36% → 90%)
- [ ] 3.3 Extend tests for src/tools/calendar/providers/factory.js (34.48% → 90%)
- [ ] 3.4 Extend tests for src/tools/calendar/providers/google.js (29.51% → 90%)
- [ ] 3.5 Extend tests for src/tools/calendar/providers/msgraph.js (28.75% → 90%)

## 4. Email Provider Tests

- [ ] 4.1 Extend tests for src/tools/email/providers/base.js (77.54% → 90%)
- [ ] 4.2 Extend tests for src/tools/email/providers/gmail.js (21.89% → 90%)
- [ ] 4.3 Extend tests for src/tools/email/providers/graph.js (18.52% → 90%)
- [ ] 4.4 Extend tests for src/tools/email/providers/imap.js (24.43% → 90%)

## 5. Core Utility Tests (No Existing Tests)

- [ ] 5.1 Create tests for src/tools/compactContext/index.js (23.40%)
- [ ] 5.2 Create tests for src/scheduler/cron.js (30.41%)

## 6. Existing Test Extensions

- [ ] 6.1 Extend tests for src/session/shutdown.js (68.89% → 90%)
- [ ] 6.2 Extend tests for src/shared/logger.js (76.61% → 90%)
- [ ] 6.3 Extend tests for src/skills/registry.js (65.87% → 90%)
- [ ] 6.4 Extend tests for src/tools/yaml/index.js (77.85% → 90%)
- [ ] 6.5 Extend tests for src/tools/webhook/index.js (71.89% → 90%)

## 7. Verification and Polish

- [ ] 7.1 Run full test suite and verify all tests pass
- [ ] 7.2 Run coverage report (`node --test --experimental-test-coverage`) and verify all priority files ≥90%
- [ ] 7.3 Run lint check and fix any issues
- [ ] 7.4 Add `// c8 ignore next` comments for genuinely untestable paths
