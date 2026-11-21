# Tasks

## 1. Fix Primary Silent-Catch Sites

- [ ] 1.1 Fix `src/vector/chunker.js` — log stat/read failures via `logError` instead of returning `[]` silently; verify unit tests cover the failure path
- [ ] 1.2 Fix `src/sandbox/urlFilter.js` — log invalid-URL parse failures via `logError` (debug level) instead of returning `false` silently; verify unit tests cover the parse-failure path
- [ ] 1.3 Fix `src/tools/webhook/index.js` — log JSON parse failures via `logError` instead of treating them as "no webhooks"; verify unit tests cover the parse-failure path

## 2. Document Intentional Swallows

- [ ] 2.1 Add explicit documentation comments to intentional swallows in `src/stream/loopDetector.js` (failed check must never break streaming) and `src/vector/indexerWorker.js` (serialization queue guard); verify comments present and no behavior change
- [ ] 2.2 Add explicit documentation comments to response-body read fallbacks (`.catch(() => "")`) in `src/tools/api/index.js` and `src/tools/web/index.js`; verify comments present and no behavior change

## 3. Promote `logError` Convention

- [ ] 3.1 Promote `logError` for use in the fixed catch sites and confirm it is imported from `src/shared/logger.js`; verify no bare `catch {}` remains in the changed files

## 4. Tests

- [ ] 4.1 Add unit tests asserting failures are logged (mock `logger` and assert `logError`/`logger.*` calls) for `chunker`, `urlFilter`, and `webhook`; verify tests pass
- [ ] 4.2 Run `npm run test`, `npm run lint`, and `npm run coverage` and verify all pass with no regressions

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
