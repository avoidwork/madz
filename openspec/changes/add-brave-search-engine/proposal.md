## Why

The `searchWeb` tool currently supports DuckDuckGo, Bing, SearXNG, custom, and Tavily engines. Brave Search API is an independent web index (40+ billion pages) with an agentic-search focus, SOC 2 Type II attested, supports Zero Data Retention, and is priced at $5 per 1,000 requests with $5 free monthly credits. Adding it gives users an independent, privacy-respecting search option.

## What Changes

- Add a `brave` engine to the `searchWeb` tool.
- Add `BraveSearchSchema` (`apiKey` field) to `src/config/schemas/providers.js` and add `"brave"` to the `engine` enum.
- Add `searchWithBrave(apiKey, query, limit)` to `src/tools/web/index.js` that GETs `https://api.search.brave.com/res/v1/web/search` with `X-Subscription-Token: <key>` header and params `{ q: query, count: limit }`, mapping `web.results[].description` to the normalized `description` field.
- Add `"brave"` to `detectSearchBackend()` explicit-engine list and the inference chain (`search?.brave?.apiKey`).
- Add `searchBraveApiKey: search?.brave?.apiKey` to `runtimeOptions` in `src/tools/index.js` and include it in the `hasAnySearch` gate.
- Add a `brave:` block with `apiKey: ""` under `search:` in `config.yaml`.
- Update the `searchWeb` tool description to list Brave.

## Capabilities

### New Capabilities
- `brave-search`: Brave Search API engine implementation — request construction, response mapping, error handling, and backend selection.

### Modified Capabilities
- `web-search-config`: The `engine` enum and `SearchConfigSchema` gain `brave`; `config.yaml` gains a `brave` block; the `searchWeb` tool description lists Brave.

## Impact

- `src/config/schemas/providers.js` — add `BraveSearchSchema`, `brave` key, `"brave"` enum value.
- `src/tools/web/index.js` — add `searchWithBrave`, `"brave"` in `detectSearchBackend`, `case "brave"` in `searchWebImpl`, update tool description.
- `src/tools/index.js` — add `searchBraveApiKey` to `runtimeOptions` and `hasAnySearch` gate.
- `config.yaml` — add `brave:` block.
- `tests/unit/tools/web/searchBrave.test.js` — new tests.

## Non-goals

- Brave's `llm/context` endpoint (agentic search) is out of scope — this is web search only.
- No new npm packages; the existing `fetch` (Node 24+ global) is used.
- No changes to the other existing engines.
