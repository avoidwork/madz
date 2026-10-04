## Context

The `searchWeb` tool currently supports four engines (DuckDuckGo, Bing, SearXNG, Custom) selected via `search.engine`. Tavily was removed in PR 1193 (commit `7f14855f`) as part of clearing out dead engine config. The removal left vestigial plumbing in `src/tools/index.js` (`searchTavilyApiKey`) and `src/config/loader.js` (`TAVILY_API_KEY` mapping), so re-adding Tavily is lighter than a greenfield feature.

Tavily is a purpose-built search API for LLM agents that returns clean, semantically relevant snippets. It is called directly via `fetch` (Node 24+ global), matching the existing Bing/SearXNG/Custom engines which use the same pattern.

## Goals / Non-Goals

**Goals:**
- Add Tavily as a selectable, configurable search engine in the existing `search.engine` selector.
- Implement `searchWithTavily(apiKey, query, limit)` that POSTs to `https://api.tavily.com/search` with Bearer auth and maps `results[].content` → `description`.
- Wire Tavily into `detectSearchBackend()` (explicit engine + inference chain) and `searchWebImpl()`.
- Update the `searchWeb` tool description and `config.yaml` to reflect Tavily.
- Add unit tests covering request shape, result mapping, error handling, and backend detection.

**Non-Goals:**
- No changes to `src/tools/index.js` or `src/config/loader.js` — the vestigial `searchTavilyApiKey` plumbing and `TAVILY_API_KEY` mapping already exist and activate once the schema re-adds `tavily`.
- No new npm dependencies.
- No changes to other removed engines (exa, firecrawl, parallel).

## Decisions

### Decision 1: Direct `fetch` call, not the `@tavily/core` SDK
- **Rationale**: Matches the existing Bing/SearXNG/Custom engines which all use direct `fetch`. Avoids a new dependency.
- **Alternative considered**: `@tavily/core` SDK — rejected to keep the engine implementations uniform and dependency-free.

### Decision 2: Request shape
- POST to `https://api.tavily.com/search` with `Authorization: Bearer <key>` and JSON body `{ query, search_depth: "basic", max_results: limit }`.
- **Rationale**: `search_depth: "basic"` returns fast, snippet-level results suitable for the normalized `title`/`url`/`description` shape used by other engines. `max_results` is clamped to 1–100 consistent with the existing `searchWebImpl` guard.

### Decision 3: Result normalization
- Map `results[].content` → `description`, `results[].title` → `title`, `results[].url` → `url`, with fallbacks (`"Untitled"`, `""`).
- **Rationale**: Consistent with the normalized shape returned by Bing/SearXNG/Custom.

### Decision 4: Backend selection
- Add `"tavily"` to the explicit-engine list in `detectSearchBackend()` and add a `search?.tavily?.apiKey` inference before the duckduckgo fallback.
- **Rationale**: Mirrors how `bing` is inferred from `search.bing.apiKey`. Tavily requires an API key, so it is only inferred when one is configured.

### Decision 5: Error handling
- Non-2xx responses return `{ ok: false, error: "Tavily API error (<status>): <text>" }`, consistent with the Bing engine. Network failures return `{ ok: false, error: "Tavily search failed" }`.
- **Rationale**: Uniform error shape across engines; the `searchWebImpl` switch already handles `!result.ok`.

## Risks / Trade-offs

- **[Missing/empty API key]** → `searchWithTavily` is only dispatched when `search.tavily.apiKey` is set (via inference or explicit engine). If the key is empty, the request will fail with a 401 and return an error result, which `searchWebImpl` surfaces cleanly.
- **[Rate limiting (429)]** → Returns `{ ok: false, error }`; no retry logic is added, matching the existing engines.
- **[Vestigial plumbing activation]** → `src/tools/index.js` and `src/config/loader.js` already reference `TAVILY_API_KEY`; re-adding `tavily` to the schema activates them. Verified by existing tests in `tool_index.test.js` and `tool_registration.test.js`.
