## Context

The `searchWeb` tool in `src/tools/web/index.js` currently supports DuckDuckGo (default), Bing, SearXNG, Custom, and Tavily. Backend selection is config-inference based via `detectSearchBackend()`: it checks `search.custom.url`, then `search.bing.apiKey`, then `search.tavily.apiKey`, then `search.searxng.url`, and falls back to `duckduckgo`. There is no explicit `engine` field in the current schema — the `web-search-config` spec's `engine` requirements describe a design that was later simplified to inference-only.

Firecrawl was removed in PR #1193 as dead config. Its `/v2/search` endpoint is genuinely useful (search + scrape, query operators, geo-targeting, category filters). This change re-adds it following the Tavily pattern exactly.

## Goals / Non-Goals

**Goals:**
- Re-add Firecrawl as a selectable search backend in `searchWeb`.
- Minimal config surface: `apiKey` only, `sources: ["web"]` hardcoded, `limit` from tool input.
- Follow the existing Tavily implementation pattern for consistency.

**Non-Goals:**
- Firecrawl's full scrape capability (search only).
- Any new npm packages — uses the existing `fetch` (Node 24+ global).
- Adding an explicit `engine` selector field (backend selection remains config-inference based).

## Decisions

### Decision 1: Follow the Tavily pattern
Firecrawl is structurally identical to Tavily — a POST to a search API with a Bearer token and a JSON body. We mirror `searchWithTavily` exactly: same error handling (401/408/500 → `{ ok: false, error }`, fetch throw → `{ ok: false, error }`, empty results → `{ ok: true, results: [] }`), same `AbortController` timeout, same result normalization.

**Alternatives considered:**
- Reuse a generic `searchWithPost` helper — rejected for KISS; the existing codebase keeps each backend as a distinct function.

### Decision 2: Backend inference, not an explicit engine field
The current `detectSearchBackend()` infers the engine from config. We add `if (search?.firecrawl?.apiKey) return "firecrawl";` to the inference chain, before the `duckduckgo` fallback. This matches how Tavily was added and avoids introducing an `engine` field that the current schema doesn't have.

### Decision 3: Result mapping
Firecrawl's `/v2/search` returns results under `data.web[]`. Map `data.web[].description` → the normalized `description` field, `data.web[].title` → `title`, `data.web[].url` → `url`. Handle missing/empty `data.web` gracefully.

## Risks / Trade-offs

- **Firecrawl API shape may differ from documented** → Mitigation: map defensively (`data.web || []`), and the tests mock the response shape so behavior is deterministic.
- **API key exposure** → Mitigation: key passed only via `Authorization: Bearer` header, never logged. Outbound URL validated against the `urlFilter` allowlist.
- **The `web-search-config` spec currently asserts Firecrawl is absent** → Mitigation: this change includes a delta spec that removes those requirements and adds Firecrawl as an implemented engine.
