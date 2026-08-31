## 1. Critical — No Test Files

- [x] 1.1 Create tests for `src/tools/calendar/index.js` (100% ✅)
  - Test file exists, tests pass
  - Calendar tool wrapper creation, action switch, error paths
  - Mock provider methods (readEvents, createEvent, etc.)

- [ ] 1.2 Create tests for `src/tools/webhook/index.js` (73.09% — no test file)
  - Test `ensureWebhooksDir()`, `loadWebhooks()`, `saveWebhooks()`, `generateId()`
  - Test `createWebhook()` with URL validation, secret validation, persistence
  - Test `listWebhooks()` with includeSecret option
  - Test `deleteWebhook()` not-found error
  - Test `verifyWebhook()` — HMAC-SHA256, timing-safe comparison, sha256= prefix stripping, length mismatch
  - Test `webhookManagementImpl()` full action switch
  - Test `createWebhookTool()` factory
  - **Effort: Medium**

## 2. High Priority — Many Untested Methods

- [ ] 2.1 Extend `src/tools/calendar/providers/google.js` (29.51% → 90%)
  - Test file exists but has module resolution errors (mock tracker issues)
  - `#withTimeout()` — AbortController, timeout, 401 retry with token refresh
  - `#refreshAccessToken()` — OAuth2 token refresh
  - `#sanitizeError()` — credential redaction
  - `send()` — Gmail send email
  - `search()` — Gmail search
  - `saveDraft()`, `listDrafts()`, `updateDraft()`, `deleteDraft()` — draft operations
  - `organize()` — markRead, markUnread, archive, addLabel, removeLabel
  - `#buildRawMessage()` — MIME message builder with attachments
  - `#normalizeMessage()` — Gmail API response normalization
  - `findAvailability()`, `generateSummary()`
  - **Effort: Large**

- [ ] 2.2 Extend `src/tools/calendar/providers/msgraph.js` (28.75% → 90%)
  - Test file exists but has module resolution errors (mock tracker issues)
  - `#sanitizeError()` — credential redaction
  - `#fetchWithTimeout()` — AbortController, timeout, 401 retry
  - `#getAccessToken()`, `#refreshAccessToken()` — auth flows
  - `read()`, `search()` — email operations
  - `saveDraft()`, `listDrafts()`, `updateDraft()`, `deleteDraft()` — draft operations
  - `organize()` — markRead, markUnread, archive, addLabel, removeLabel
  - `#normalizeMessage()` — Microsoft Graph response normalization
  - **Effort: Large**

- [ ] 2.3 Extend `src/tools/email/providers/gmail.js` (21.89% → 90%)
  - Test file exists but needs significant coverage improvement
  - `#refreshAccessToken()` — OAuth2 token refresh
  - `#withTimeout()` — AbortController, timeout, 401 retry
  - `send()`, `read()`, `search()` — core operations
  - `saveDraft()`, `listDrafts()`, `updateDraft()`, `deleteDraft()` — draft operations
  - `organize()` — markRead, markUnread, archive, addLabel, removeLabel
  - `cancel()` — abort operation
  - **Effort: Large**

- [ ] 2.4 Extend `src/tools/email/providers/graph.js` (18.52% → 90%)
  - Test file exists but tests are being cancelled (constructor tests failing)
  - `#fetchWithTimeout()` — AbortController, timeout, 401 retry
  - `#getAccessToken()`, `#refreshAccessToken()` — auth flows
  - `send()`, `read()`, `search()` — core operations
  - `saveDraft()`, `listDrafts()`, `updateDraft()`, `deleteDraft()` — draft operations
  - `organize()` — markRead, markUnread, archive, addLabel, removeLabel
  - `cancel()` — abort operation
  - **Effort: Large**

- [ ] 2.5 Extend `src/tools/email/providers/imap.js` (24.43% → 90%)
  - Test file exists but needs significant coverage improvement
  - `#withTimeout()` — AbortController, timeout
  - `send()`, `read()`, `search()` — core operations
  - `saveDraft()`, `listDrafts()`, `updateDraft()`, `deleteDraft()` — draft operations
  - `organize()` — markRead, markUnread, archive, addLabel, removeLabel
  - `cancel()` — abort operation
  - **Effort: Large**

## 3. Medium Priority — Significant Gaps

- [ ] 3.1 Extend `src/tools/calendar/providers/base.js` (42.36% → 90%)
  - Test file exists but needs significant coverage improvement
  - `#enforceRateLimit()` — window reset, count increment, throw on limit exceeded
  - `_executeWithRetry()` — exponential backoff, timeout, AbortController, rate limit error handling, HTTP 429/500/503 retry logic
  - **Effort: Large**

- [ ] 3.2 Extend `src/scheduler/cron.js` (30.41% → 90%)
  - Test file exists but needs significant coverage improvement
  - `runExec()` — private function wrapping `child_process.exec` with stdin support
  - `_readCrontab()` — read crontab via `crontab -l`
  - `_writeCrontab()` — write crontab via `crontab -`
  - Success paths for `add()`, `remove()`, `install()`, `uninstall()` with mocked exec
  - Edge cases for `list()` — entries without cron field
  - Full diff logic for `sync()` with actual crontab reads/writes
  - **Effort: Large**

- [ ] 3.3 Extend `src/skills/registry.js` (65.87% → 90%)
  - Test file exists, 16 tests pass
  - `#rebuildCatalog()` — catalog rebuild logic
  - `get()`, `list()`, `has()`, `getCatalog()` — accessor methods
  - `getSkillBody()` — body retrieval
  - `register()`, `unregister()` — lifecycle
  - `disable()`, `enable()` — state transitions
  - `getErrors()`, `size` getter, `getSkillPaths()`, `getSkillPathsForAgent()`
  - `#relativePath()` — path resolution
  - Test full lifecycle: register → get → list → has → catalog → body → disable → enable → unregister
  - **Effort: Medium**

- [ ] 3.4 Extend `src/tools/spreadsheet/spreadsheet.js` (33.27% → 90%)
  - Test file exists but needs significant coverage improvement
  - `compute()` — missing: `variance` operation, `formula` with invalid formula
  - `generate()` — missing: sheets with formulas, formatting, multi-column cells
  - `analyze()` — missing: `percentile` analysis type, `groupBy` analysis type
  - `csvImport()` — missing: trim option, quote option, header option
  - `csvExport()` — missing: header option
  - `modify()` — missing: addCell, deleteCell, addSheet, deleteSheet, renameSheet operations, sheet not found error, missing inputPath error
  - `exportData()` — missing: unsupported format error, empty data error
  - **Effort: Large**

- [ ] 3.5 Extend `src/shared/logger.js` (76.61% → 90%)
  - Test file exists, 4 tests pass
  - `getLogDirectory()` — Alpine Linux detection, darwin platform, win32 platform, default fallback
  - `tryCreateDirectory()` — private function
  - Log directory creation with fallback — module-level initialization
  - Pino logger initialization (silent mode, multistream) — module-level initialization
  - `flush()` — exported function
  - `logger` object methods (info, warn, error, debug, fatal, silent)
  - **Effort: Medium**

- [ ] 3.6 Extend `src/tools/yaml/index.js` (77.85% → 90%)
  - Test file exists, 16 tests pass
  - `parseYaml()` — empty YAML returning null
  - `serializeYaml()` — opts.indent, opts.lineWidth, non-string input
  - `transformYaml()` — invalid mapping JSON, nested mapping with dot notation, array transformation
  - `filterYaml()` — wildcard `[*]` path, array index access `key[0]`, out of bounds array index, not an array for index access
  - `yamlManipulation()` — wrapper that parses JSON input
  - `createYamlTool()` — tool factory
  - **Effort: Medium**

## 4. Low Priority — Minor Gaps

- [x] 4.1 Extend `src/tools/calendar/providers/factory.js` (100% ✅)
  - Test file exists, tests pass
  - `getActiveCalendarProvider()` without config argument exercises `loadConfig()` fallback

- [x] 4.2 Extend `src/tools/spreadsheet/formulaParser.js` (93.39% ✅)
  - Test file exists, 118 tests pass
  - `getRefs()` — extract cell references from AST
  - `colToNum()`, `numToCol()` — column conversion utilities
  - `evaluateRange()` — invalid range format, non-cell refs in range
  - Function edge cases: COUNTA with 0 value, CONCATENATE with null/undefined, MID out-of-bounds, LEFT/RIGHT with n=0, SQRT with 0, CEILING/FLOOR with negatives, INT with negatives

- [x] 4.3 Extend `src/tools/spreadsheet/pivot.js` (95.54% ✅)
  - Test file exists, 35 tests pass
  - `pivot()` — missing: `min`, `max` aggregation for single-key pivot
  - `computeAggregate()` — empty values array returns 0

- [x] 4.4 Extend `src/tools/spreadsheet/stats.js` (100% ✅)
  - Test file exists, 51 tests pass
  - `safeNumber` filter edge cases: mean, median, stddev, variance, percentile, populationStddev, populationVariance — all non-numeric values return 0 or throw
  - `mode()` — String(v) key collision edge case ("1" and 1 are same key)

- [ ] 4.5 Extend `src/tools/spreadsheet/csv.js` (37.06% → 90%)
  - Test file exists but needs significant coverage improvement
  - `csvImport()` — escape option, skip_empty_lines option, columns option, encoding option
  - `csvExport()` — columns option, record_delimiter option, cast for Date/object/number types
  - `csvToJson()` — zero coverage
  - `jsonToCsv()` — zero coverage
  - `toXlsxFormat()` — zero coverage
  - **Effort: Large**

- [x] 4.6 Extend `src/tools/compactContext/index.js` (91.87% ✅)
  - Test file exists, 55 tests pass
  - `options.threadConfig` path in `createCompactContextTool()`
  - Verify individual tiered retention strategy outputs

- [x] 4.7 Extend `src/session/shutdown.js` (100% ✅)
  - Test file exists, 12 tests pass
  - Flush failure after handler completes
  - Double-removal safety for `process.off()`

- [x] 4.8 Extend `src/session/checkpointer.js` (100% ✅)
  - Test file exists, tests pass
  - `createCheckpointer()` — memory mode, sqlite mode, null config, unknown mode fallback
  - `createSqliteCheckpointer()` — DB creation, parent directory creation, default path, WAL mode
  - `ensureCheckpointsDir()` — directory creation with recursive flag

- [x] 4.9 Extend `src/memory/prompts.js` (100% ✅)
  - Test file exists, tests pass
  - All paths covered including edge cases

## 5. Verification and Polish

- [ ] 5.1 Run full test suite and verify all tests pass
- [ ] 5.2 Run coverage report (`node --test --experimental-test-coverage`) and verify all priority files ≥90%
- [ ] 5.3 Run lint check and fix any issues
- [ ] 5.4 Add `// c8 ignore next` comments for genuinely untestable paths
