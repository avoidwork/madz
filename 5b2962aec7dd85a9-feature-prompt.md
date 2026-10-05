CHANGE_NAME: re-add-firecrawl-search-engine

## Summary

Re-add Firecrawl as a search engine option in the `searchWeb` tool. Firecrawl was removed in PR #1193 as part of clearing dead engine config. Its `/v2/search` endpoint combines web search with scraping, returning full page content for any query, and supports query operators, geo-targeting, and category filters.

## Technical Approach

The `searchWeb` tool lives in `src/tools/web/index.js` and currently supports DuckDuckGo (default), Bing, SearXNG, Custom, and Tavily. Backends are selected by `detectSearchBackend()` which infers the engine from config (e.g., `search.bing.apiKey`, `search.tavily.apiKey`) rather than an explicit `engine` field. We add Firecrawl as a new backend following the Tavily pattern exactly.

### Schema (`src/config/schemas/providers.js`)

Add a `FirecrawlSearchSchema` with `apiKey: z.string().optional().default("")`, add `firecrawl: FirecrawlSearchSchema.default({})` to `SearchConfigSchema`. No `engine` enum exists in the current schema — backend selection is config-inference based, so no enum change is needed.

### Implementation (`src/tools/web/index.js`)

Add `searchWithFirecrawl(apiKey, query, limit)` that POSTs to `https://api.firecrawl.dev/v2/search` with `Authorization: Bearer <key>` and body `{ query, limit, sources: ["web"] }`. Map `data.web[].description` → the normalized `description` field. Mirror `searchWithTavily`'s error handling (401/408/500, empty results, fetch throw).

### Backend selection

Add `if (search?.firecrawl?.apiKey) return "firecrawl";` to `detectSearchBackend` before the `duckduckgo` fallback. Add `const firecrawl = search?.firecrawl || {};` and `case "firecrawl":` in `searchWebImpl`.

### Config

Add `firecrawl:` block with `apiKey: ""` under `search:` in `config.yaml`. `src/config/loader.js` already drops the `search` key, so `search.firecrawl.apiKey` maps to `FIRECRAWL_API_KEY` automatically. `src/tools/index.js` already plumbs `searchFirecrawlApiKey` through `runtimeOptions`.

## Testing

Add `tests/unit/tools/web/searchFirecrawl.test.js` mirroring `searchTavily.test.js`: mocked fetch for request shape, `data.web[].description` mapping, 401/408/500 errors, empty results, limit clamping, and a `detectSearchBackend` firecrawl case.

## Security Considerations

- API key passed via `Authorization: Bearer` header, never logged.
- Outbound URL validated against the allowlist (already enforced by `urlFilter`).
- Strip PII from any logged response.

## Dependencies

No new npm packages — use the existing `fetch` (Node 24+ global).
