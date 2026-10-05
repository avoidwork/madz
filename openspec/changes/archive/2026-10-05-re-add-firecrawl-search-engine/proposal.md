## Why

Firecrawl's `/v2/search` endpoint combines web search with scraping, returning full page content for any query. It was removed in PR #1193 as part of clearing dead engine config, but it is genuinely useful — it supports query operators (`site:`, `filetype:`, `inurl:`), geo-targeting, and category filters. Re-adding it restores a capability that was removed as dead config but is actively valuable.

## What Changes

- Add a `FirecrawlSearchSchema` (`apiKey` field) and a `firecrawl` key to `SearchConfigSchema` in `src/config/schemas/providers.js`.
- Implement `searchWithFirecrawl(apiKey, query, limit)` in `src/tools/web/index.js` that POSTs to `https://api.firecrawl.dev/v2/search` with `Authorization: Bearer <key>` and body `{ query, limit, sources: ["web"] }`.
- Wire `"firecrawl"` into `detectSearchBackend()` inference chain and a `case "firecrawl"` into `searchWebImpl()`.
- Add Firecrawl to the `searchWeb` tool description's built-in engines list.
- Add a `firecrawl:` block with `apiKey: ""` under `search:` in `config.yaml`.
- Update the `web-search-config` spec to reflect that Firecrawl is now an implemented engine (removing the "firecrawl is absent" requirements).

## Capabilities

### New Capabilities
- `firecrawl-search`: Firecrawl search engine implementation, backend selection, and result normalization.

### Modified Capabilities
- `web-search-config`: Update the requirements that currently assert Firecrawl is absent from the schema, config.yaml, and tool description. Firecrawl becomes an implemented engine.

## Impact

- `src/config/schemas/providers.js` — add `FirecrawlSearchSchema` and `firecrawl` key.
- `src/tools/web/index.js` — add `searchWithFirecrawl`, wire backend detection and dispatch.
- `config.yaml` — add `firecrawl:` block.
- `src/tools/index.js` — no change needed; `searchFirecrawlApiKey` is already plumbed through `runtimeOptions`.
- `src/config/loader.js` — no change needed; `search` is already in `DROPPED_KEYS`, so `search.firecrawl.apiKey` maps to `FIRECRAWL_API_KEY`.
- `tests/unit/tools/web/searchFirecrawl.test.js` — new tests.

## Non-goals

- Firecrawl's full scrape capability (this is search only).
- Any new npm packages — uses the existing `fetch` (Node 24+ global).
- Adding an explicit `engine` selector field (backend selection remains config-inference based).
