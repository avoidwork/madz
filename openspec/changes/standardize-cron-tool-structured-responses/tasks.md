# Tasks

## 1. Convert cronJobImpl returns to native objects

- [ ] 1.1 Replace all `return JSON.stringify({ ok: true, ...result })` returns in `cronJobImpl` with `return { ok: true, ...result }` and verify the cron unit tests pass
- [ ] 1.2 Replace all `return JSON.stringify({ ok: false, error: ... })` returns in `cronJobImpl` with `return { ok: false, error: ... }` and verify the cron unit tests pass
- [ ] 1.3 Convert the `run` action's `return JSON.stringify(result)` to `return result` and verify the cron unit tests pass
- [ ] 1.4 Convert the catch block's `return JSON.stringify({ ok: false, error: ... })` to `return { ok: false, error: ... }` and verify the cron unit tests pass

## 2. Update JSDoc annotations

- [ ] 2.1 Update `cronJobImpl` `@returns` from `{Promise<string>} JSON result string` to `{Promise<object>} Structured result object` and verify the file lints
- [ ] 2.2 Update the `cronJob` tool wrapper's `@returns` annotation to reflect the native object return and verify the file lints

## 3. Update unit tests to assert native object shape

- [ ] 3.1 Replace all `JSON.parse(result)` calls in `tests/unit/tools_cron.test.js` with direct object property access and verify the cron unit tests pass
- [ ] 3.2 Add assertions that the impl returns a native object (not a string) on both success and failure paths and verify the cron unit tests pass

## 4. Verify no regressions

- [ ] 4.1 Run `npm run test` and verify all tests pass
- [ ] 4.2 Run `npm run lint` and verify lint passes
- [ ] 4.3 Run `npm run coverage` and verify coverage is maintained
