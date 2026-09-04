## 1. Spreadsheet Module (worst coverage)

- [x] 1.1 Extend formulaParser tests to cover tokenize, parseExpression, evaluateNode, all built-in functions, ranges, cell refs, booleans, strings
- [x] 1.2 Extend pivot tests to cover all pivot operations and edge cases
- [x] 1.3 Extend stats tests to cover all statistical functions
- [x] 1.4 Extend spreadsheet tests to cover all computation paths

## 2. Email Provider Module

- [ ] 2.1 Create/extend tests for Gmail provider with mocked Gmail API
- [ ] 2.2 Create/extend tests for Microsoft Graph provider with mocked Graph API
- [ ] 2.3 Create/extend tests for IMAP provider with mocked IMAP connections
- [ ] 2.4 Extend base email provider tests to cover remaining paths

## 3. Calendar Provider Module

- [ ] 3.1 Create/extend tests for Google Calendar provider with mocked API
- [ ] 3.2 Create/extend tests for MS Graph Calendar provider with mocked API
- [ ] 3.3 Extend base calendar provider tests to cover remaining paths
- [ ] 3.4 Extend calendar factory tests to cover all provider creation paths

## 4. Core Infrastructure

- [ ] 4.1 Create test file for compactContext/index.js
- [ ] 4.2 Create test file for scheduler/cron.js
- [ ] 4.3 Extend shutdown.test.js to cover process signal handlers
- [ ] 4.4 Extend logger.test.js to cover structured logging, PII redaction, flush

## 5. Remaining Untested Files

- [ ] 5.1 Create tests for src/agent/ files (5 files)
- [ ] 5.2 Create tests for src/config/ files (15 files)
- [ ] 5.3 Create tests for src/memory/ files (10 files)
- [ ] 5.4 Create tests for src/telemetry/ files (8 files)
- [ ] 5.5 Create tests for src/tui/ files (17 files)
- [ ] 5.6 Create tests for remaining src/tools/ root-level files
- [ ] 5.7 Create tests for any other files below 90% coverage

## 6. Verification

- [ ] 6.1 Run full test suite and verify no regressions
- [ ] 6.2 Run full coverage report and verify overall coverage improvement
- [ ] 6.3 Update coverage.txt with final results
