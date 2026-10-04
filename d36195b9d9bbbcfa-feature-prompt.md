CHANGE_NAME: re-add-tavily-search-engine

## Summary

Re-add Tavily as a first-class, configurable search engine option for the `searchWeb` tool. Tavily was removed in PR 1193 (commit `7f14855f`) as part of clearing out dead engine config (exa, firecrawl, tavily, parallel). This change restores it as a fully wired, configurable engine that plugs into the existing `search.engine` selector.

## Motivation

Tavily is a purpose-built search API for LLM agents — it returns clean, semantically relevant snippets rather than raw HTML. The current engine set (DuckDuckGo, Bing, SearXNG, Custom) lacks a dedicated agent-oriented search backend. Re-adding Tavily gives users a higher-quality, agent-tuned search option. The removal left vestigial plumbing in `src/tools/index.js` (`searchTavilyApiKey`) and `src/config/loader.js` (`TAVILY_API_KEY` mapping), so re-adding is lighter than a greenfield feature.

## Technical Approach

The change spans four source/config files plus tests:

1. **Config schema** (`src/config/schemas/providers.js`): Add a `TavilySearchSchema` with `apiKey: z.string().optional().default("")`, add `tavily: TavilySearchSchema.default({})` to `SearchConfigSchema`, and add `"tavily"` to the `engine` enum.

2. **Search implementation** (`src/tools/web/index.js`): Add `searchWithTavily(apiKey, query, limit)` that POSTs to `https://api.tavily.com/search` with `Authorization: Bearer <key>` and a JSON body of `{ query, search_depth: "basic", max_results: limit }`. Map the response `results[].content` field to the normalized `description` field used by other engines, with `title` and `url` fallbacks. Use `AbortController` + `FETCH_TIMEOUT` consistent with the existing Bing/SearXNG/Custom engines.

3. **Backend selection** (`src/tools/web/index.js`): Add `"tavily"` to the explicit-engine list in `detectSearchBackend`, add a `search?.tavily?.apiKey` inference before the duckduckgo fallback, and add `const tavily = search?.tavily || {}` plus a `case "tavily"` in `searchWebImpl`.

4. **Tool description** (`src/tools/web/index.js`): Update the `searchWeb` description to list Tavily as a supported engine.

5. **Config file** (`config.yaml`): Add a `tavily:` block with `apiKey: ""` under `search:`.

6. **Tests**: Add `tests/unit/tools/web/searchTavily.test.js` (mocked `fetch`: request shape, content→description mapping, 401/429 errors, empty results) and a `detectSearchBackend` tavily case in `tests/unit/tools/web.test.js`.

## Architectural Decisions

- **No new npm packages** — Tavily is called directly via `fetch` (Node 24+ global), matching the existing Bing/SearXNG/Custom engines.
- **Credential storage** — `apiKey` is read from config/env (`TAVILY_API_KEY`) and never hardcoded. It is passed only in the `Authorization` header of the outbound request.
- **Input validation** — `query` is validated as a non-empty string and `limit` is clamped to 1–100 before dispatch, consistent with the existing `searchWebImpl` guard.
- **OWASP** — The outbound URL is a fixed, allowlisted endpoint; no user-controlled URL is constructed. No PII is logged.

## Non-goals

- No changes to `src/tools/index.js` or `src/config/loader.js` — the vestigial `searchTavilyApiKey` plumbing and `TAVILY_API_KEY` mapping already exist and activate once the schema re-adds `tavily`.
- No new npm dependencies.
- No changes to other removed engines (exa, firecrawl, parallel).
