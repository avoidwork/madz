# Test Patterns — re-add-tavily-search-engine

## Framework
- `node:test` built-in (`describe`, `it`, `mock`, `before`, `after`, `beforeEach`)
- `node:assert/strict` (strict mode) — `assert.strictEqual`, `assert.match`, `assert.ok`

## Source files to modify
- `src/config/schemas/providers.js` — no direct test file; covered via config tests
- `src/tools/web/index.js` — covered by `tests/unit/tools/web.test.js`

## Related test files
- `tests/unit/tools/web.test.js` — imports `detectSearchBackend`, `searchWebImpl` from `../../../src/tools/web/index.js`. Uses `mock.method(globalThis, "fetch", ...)` to mock fetch, captures URL, restores via `fetchMock.mock.restore()` in `finally`.
- `tests/unit/tool_index.test.js` — `beforeEach`/`afterEach` delete `process.env.TAVILY_API_KEY` (line 57, 70). Already references TAVILY.
- `tests/unit/tool_registration.test.js` — `beforeEach` deletes `TAVILY_API_KEY`; `before`/`after` save/restore `TAVILY_API_KEY` (lines 14, 27, 41).

## Conventions
- Tests mirror `src/` structure in `tests/unit/`.
- Mock external services via `mock.method(globalThis, "fetch", ...)`.
- Assertion style: `node:assert/strict`.
- `describe`/`it` nesting.
- For `searchWebImpl`, tests call it with `{ query, limit }` and an options object `{ search: { engine, ... } }`, then `JSON.parse(result)` and assert on `parsed.ok`, `parsed.backend`, `parsed.results`.

## New test file
- `tests/unit/tools/web/searchTavily.test.js` — new, mirrors `src/tools/web/index.js`. Should test `searchWithTavily` (mocked fetch: request shape, content→description, 401/429, empty results) and add a `detectSearchBackend` tavily case.
