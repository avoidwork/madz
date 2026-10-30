# Tasks

## 1. Refactor searchCodeImpl

- [ ] 1.1 Update JSDoc `@returns` for `searchCodeImpl` in `src/tools/code/searchCode.js` from `{Promise<string>}` to `{Promise<{ok: boolean, ...}>}` and verify the file still parses
- [ ] 1.2 Convert `searchCodeImpl` error paths (unknown project, store open failure, FTS search failure, no matching code, no results matching filter, embed failure, no embedding generated, hybrid search failure, search failure) to return `{ ok: false, error }` and verify via unit tests
- [ ] 1.3 Convert `searchCodeImpl` success paths (fulltext, hybrid, vector) to return `{ ok: true, results, count }` preserving result fields (filePath, lineStart, lineEnd, score, content, source) and verify via unit tests

## 2. Refactor indexCodeImpl

- [ ] 2.1 Update JSDoc `@returns` for `indexCodeImpl` in `src/tools/code/indexCode.js` from `{Promise<string>}` to `{Promise<{ok: boolean, ...}>}` and verify the file still parses
- [ ] 2.2 Convert `indexCodeImpl` no-projects-configured path to return `{ ok: false, error }` and verify via unit tests
- [ ] 2.3 Convert `indexCodeImpl` success paths to return `{ ok: true, results }` with per-project objects `{ name, indexed, skipped, errors }` and per-project error entries `{ name, error }` and verify via unit tests

## 3. Update Unit Tests

- [ ] 3.1 Update `tests/unit/tools/codeSearch.test.js` to assert `result.ok === true` / `result.ok === false` and `results` / `error` fields, and verify `npm run test` passes
- [ ] 3.2 Update `tests/unit/tools/codeIndex.test.js` to assert `result.ok === true` / `result.ok === false` and `results` / `error` fields, and verify `npm run test` passes

## 4. Verification

- [ ] 4.1 Run `npm run test` and verify all tests pass
- [ ] 4.2 Run `npm run lint` and verify lint passes
- [ ] 4.3 Run `npm run coverage` and verify coverage is maintained
