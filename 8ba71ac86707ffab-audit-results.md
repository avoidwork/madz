# Audit Results: re-add-exa-search-engine

## Goal Fulfillment

All 7 goals are satisfied:

1. **Config schema** — `ExaSearchSchema` added with `apiKey: z.string().optional().default("")`; `exa: ExaSearchSchema.default({})` added to `SearchConfigSchema`. ✅
2. **Exa backend** — `searchWithExa(apiKey, query, limit)` added, POSTs to `https://api.exa.ai/search` with `x-api-key` header and body `{ query, type: "auto", numResults: limit }`. Maps `results[].text` or `results[].highlights[0]` → `description`. ✅
3. **Backend selection** — `"exa"` added to `detectSearchBackend` inference chain (`search?.exa?.apiKey`); `const exa = search?.exa || {}` and `case "exa"` added to `searchWebImpl()`. ✅
4. **Tool description** — Exa added to the `searchWeb` built-in engines list. ✅
5. **config.yaml** — `exa:` block with `apiKey: ""` added under `search:`. ✅
6. **Tests** — `tests/unit/tools/web/searchExa.test.js` added (10 tests, all passing): request shape, `text`/`highlights` mapping, 401/402/429 errors, empty results, numResults clamping, and `detectSearchBackend` exa case. ✅
7. **Verification** — `npm run test` (3951/3952 pass), `npm run lint` (0 errors), `npm run coverage` (web tool at 92.89%, providers.js at 100%). ✅

## Spec Compliance

- `exa-search` spec requirements all implemented and covered by tests.
- `web-search-config` delta spec updated to reflect Exa as an implemented engine (removed the "exa absent" requirements).

## Deviation from Issue Body

The issue body's audit findings referenced an `engine` enum in `src/config/schemas/providers.js` (line 50) and an explicit-engine list in `detectSearchBackend` (line 277). **These do not exist in the current codebase** — `detectSearchBackend` uses pure inference (custom > bing > tavily > searxng > duckduckgo), and there is no `engine` field in the search config schema. The implementation was reconciled to the actual code: Exa was added to the inference chain rather than an explicit-engine list. The `web-search-config` spec's "engine selector" requirements were left untouched as they are out of scope for this change.

## Pre-existing Test Failure

`tests/unit/tools/web.test.js` "returns duckduckgo when no config is provided" fails because the `TAVILY_API_KEY` env var is set in this shell, populating `config.search.tavily.apiKey` and causing `detectSearchBackend({})` to fall back to module-level config → `tavily`. This failure is **pre-existing and environment-dependent** — it fails identically on `main` and is not caused by this change.

## Quality Check

- No forbidden patterns introduced.
- `searchWithExa` follows the same structure as `searchWithTavily` (AbortController timeout, error handling, result mapping).
- JSDoc present on the new public function.
- No new npm dependencies.
