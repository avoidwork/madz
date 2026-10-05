# Test Patterns

## Source: tests/unit/tools/web/searchTavily.test.js

- **Framework**: `node:test` (`describe`, `it`, `mock`) + `node:assert/strict`
- **Mocking**: `mock.method(globalThis, "fetch", async (url, init) => {...})` — captures `url` and `init`, returns a fake response `{ ok, status, json, text }`. Restored via `fetchMock.mock.restore()` in a `finally` block.
- **Structure**: `describe("searchWithTavily", () => { it(...) })` for the function, and a separate `describe("detectSearchBackend - tavily", ...)` for backend detection.
- **Assertions**: `assert.strictEqual`, `assert.deepStrictEqual`, `assert.match`.
- **Request shape test**: captures `url`/`init`, asserts method, headers, and parsed body.
- **Mapping test**: asserts `title`, `url`, `description` fields on results.
- **Error tests**: 401, 429, fetch-throw — assert `result.ok === false` and `assert.match(result.error, /status/)`.
- **Empty results test**: returns `{ ok: true, results: [] }`.
- **Clamp test**: calls with limit 0 and 500, asserts body clamped to 1 and 100.

## Conventions for new searchFirecrawl.test.js

Mirror the Tavily test exactly, adapting for Firecrawl:
- Endpoint: `https://api.firecrawl.dev/v2/search`
- Body: `{ query, limit, sources: ["web"] }`
- Results under `data.web[]`, map `data.web[].description` → `description`
- Error statuses: 401, 408, 500
