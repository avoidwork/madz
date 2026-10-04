## Why

Tavily is a purpose-built search API for LLM agents that returns clean, semantically relevant snippets rather than raw HTML. It was removed in PR 1193 as part of clearing out dead engine config (exa, firecrawl, tavily, parallel), but the current engine set (DuckDuckGo, Bing, SearXNG, Custom) lacks a dedicated agent-oriented search backend. Re-adding Tavily gives users a higher-quality, agent-tuned search option that plugs into the existing `search.engine` selector.

## What Changes

- Add a `TavilySearchSchema` (`apiKey` field) to `SearchConfigSchema` in `src/config/schemas/providers.js`, and add `"tavily"` to the `engine` enum.
- Add `searchWithTavily(apiKey, query, limit)` in `src/tools/web/index.js` that POSTs to `https://api.tavily.com/search` with `Authorization: Bearer <key>` and a JSON body of `{ query, search_depth: "basic", max_results: limit }`, mapping `results[].content` → `description`.
- Add `"tavily"` to the `detectSearchBackend()` explicit-engine list and inference chain, and a `case "tavily"` in `searchWebImpl`.
- Update the `searchWeb` tool description to list Tavily as a supported engine.
- Add a `tavily:` block with `apiKey: ""` to `config.yaml`.
- Add unit tests for `searchWithTavily` (mocked fetch) and the Tavily `detectSearchBackend` path.

## Capabilities

### New Capabilities
- `tavily-search`: The Tavily search engine implementation, including request construction, result normalization (`content` → `description`), and error handling.

### Modified Capabilities
- `web-search-config`: The search config schema, engine enum, `config.yaml` search block, and `searchWeb` tool description change to include Tavily as a supported engine. The existing requirements that explicitly exclude `tavily` (and list only duckduckgo/google/bing/searxng/custom) are updated.

## Impact

- **Code**: `src/config/schemas/providers.js`, `src/tools/web/index.js`
- **Config**: `config.yaml`
- **Tests**: `tests/unit/tools/web/searchTavily.test.js` (new), `tests/unit/tools/web.test.js`
- **Dependencies**: No new npm packages — Tavily is called directly via `fetch` (Node 24+ global), matching the existing Bing/SearXNG/Custom engines.
- **Vestigial plumbing**: `src/tools/index.js` (`searchTavilyApiKey`) and `src/config/loader.js` (`TAVILY_API_KEY` mapping) already exist and activate once the schema re-adds `tavily`; no change needed there.

## Non-goals

- No changes to `src/tools/index.js` or `src/config/loader.js` — the vestigial `searchTavilyApiKey` plumbing and `TAVILY_API_KEY` mapping already exist and activate once the schema re-adds `tavily`.
- No new npm dependencies.
- No changes to other removed engines (exa, firecrawl, parallel).
