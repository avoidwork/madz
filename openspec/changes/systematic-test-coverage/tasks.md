## 1. Spreadsheet Module — ⚠️ PARTIAL (tests exist, source coverage still low)

- [x] 1.1 Extend formulaParser tests to cover tokenize, parseExpression, evaluateNode, all built-in functions, ranges, cell refs, booleans, strings
- [x] 1.2 Extend pivot tests to cover all pivot operations and edge cases
- [x] 1.3 Extend stats tests to cover all statistical functions
- [x] 1.4 Extend spreadsheet tests to cover all computation paths
- [ ] 1.5 Increase source coverage: formulaParser.js (16.91%), csv.js (37.06%), pivot.js (25.00%), spreadsheet.js (33.27%), stats.js (34.31%) — unchanged

## 2. Email Provider Module — ⚠️ PARTIAL (tests exist, source coverage still low)

- [x] 2.1 Create/extend tests for Gmail provider with mocked Gmail API
- [x] 2.2 Create/extend tests for Microsoft Graph provider with mocked Graph API
- [x] 2.3 Create/extend tests for IMAP provider with mocked IMAP connections
- [x] 2.4 Extend base email provider tests to cover remaining paths
- [ ] 2.5 Increase source coverage: gmail.js (31.73%), graph.js (18.52%), imap.js (24.43%), base.js (86.96%), tools.js (29.48%), index.js (66.67%) — unchanged

## 3. Calendar Provider Module — ⚠️ PARTIAL (tests exist, source coverage still low)

- [x] 3.1 Create/extend tests for Google Calendar provider with mocked API
- [x] 3.2 Create/extend tests for MS Graph Calendar provider with mocked API
- [x] 3.3 Extend base calendar provider tests to cover remaining paths
- [x] 3.4 Extend calendar factory tests to cover all provider creation paths
- [ ] 3.5 Increase source coverage: index.js (18.18%), base.js (42.36%), factory.js (34.48%), google.js (29.51%), msgraph.js (28.75%) — unchanged

## 4. Core Infrastructure — ⚠️ PARTIAL

- [x] 4.1 Create test file for compactContext/index.js (coverage: 95.07% ✅)
- [x] 4.2 Create/extend test file for scheduler/cron.js (source coverage: 30.41% — needs more)
- [x] 4.3 Extend shutdown.test.js to cover process signal handlers (coverage: 100% ✅)
- [x] 4.4 Extend logger.test.js to cover structured logging, PII redaction, flush (source coverage: 82.97% — needs more)
- [ ] 4.5 Increase cron.js source coverage (30.41%) — unchanged
- [ ] 4.6 Increase logger.js source coverage to 90% (currently 82.97%) — unchanged

## 5. Remaining Untested Files — ⚠️ PARTIAL

- [x] 5.1 Create tests for src/agent/ files — agentDefinitions.js (98.68%), agentRegistry.js (100%), contextBackend.js (100%), coreBackend.js (100%), deepAgents.js (97.21%)
- [x] 5.2 Create tests for src/config/ files — loader.js (92.82% ✅), patch.js (54.72% ❌), schemas all 100% ✅
- [ ] 5.3 Create tests for src/memory/ files — context.js (97.44%), expireEphemeralMemories.js (93.15%), gc.js (99.30%), profile.js (98.48%), prompts.js (100%), reader.js (95.16%) — all ✅ (tests exist, coverage maintained)
- [ ] 5.4 Create tests for src/telemetry/ files (8 files) — ❌ NOT STARTED (unchanged)
- [ ] 5.5 Create tests for src/tui/ files — app.js (42.53%), banner.js (90.00%), commandParser.js (98.12%), contextTokens.js (70.49%), conversationArea.js (20.54%), conversationPanel.js (95.04%), inputArea.js (69.60%), inputPanel.js (100%), markdownText.js (79.66%), messageBubble.js (85.00%), messageList.js (77.73%), messages.js (100%), onboardingPanel.js (14.75%), panels.js (100%), statusBar.js (97.78%)
- [ ] 5.6 Increase coverage for remaining src/tools/ files — api/index.js (94.17%), data/index.js (79.85%), email/index.js (66.67%), graphql/index.js (72.32%), json/index.js (78.31%), namecom/index.js (70.84%), pdfGenerate/index.js (90.48%), process/index.js (87.07%), skills/index.js (88.47%), webhook/index.js (71.89%), yaml/index.js (77.85%)
- [ ] 5.7 Increase coverage for other files below 90% — sandbox/runner.js (91.58%), scheduler/scheduler.js (93.64%), session/checkpointer.js (82.89%), session/onboarding.js (95.83%), session/saver.js (98.18%), shared/logger.js (82.97%), skills/agentMapper.js (83.33%), skills/discoverer.js (95.83%), skills/registry.js (83.62%), skills/validator.js (100%), fileExtract/docx.js (48.68%), fileExtract/docxParser.js (18.22%), fileExtract/formatValidator.js (73.39%), fileExtract/pdf.js (45.00%), fileExtract/pdfParser.js (39.66%), fileExtract/pptx.js (53.62%), fileExtract/pptxParser.js (15.63%), fileExtract/xlsx.js (52.38%), fileExtract/xlsxJson.js (24.81%), fileExtract/xlsxParser.js (20.93%), fileExtract/zipExtractor.js (42.07%)

## 6. Verification — ✅ DONE

- [x] 6.1 Run full test suite and verify no regressions
- [x] 6.2 Run full coverage report and verify overall coverage improvement
- [x] 6.3 Update coverage.txt with final results

---

**Overall coverage: 69.65% line / 81.94% branch / 55.93% funcs** (up from 69.22% / 81.01% / 55.12%)

**Summary:** Tests have been written for most modules, but many source files still have low coverage because the tests don't exercise enough code paths. The biggest gaps remain in:
- Spreadsheet tools (formulaParser, csv, pivot, spreadsheet, stats)
- Email providers (gmail, graph, imap)
- Calendar providers (all)
- TUI components (conversationArea, onboardingPanel, app)
- File extraction utilities (docxParser, pptxParser, xlsxParser, etc.)
