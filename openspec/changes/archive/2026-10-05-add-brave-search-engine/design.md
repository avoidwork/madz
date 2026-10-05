## Context

The `searchWeb` tool supports multiple search engines (DuckDuckGo, Bing, SearXNG, custom, Tavily). Each engine is selected via `detectSearchBackend()` which honors an explicit `search.engine` field first, then falls back to an inference chain based on configured credentials. The config schema (`SearchConfigSchema`) declares the `engine` enum and per-engine sub-schemas. Brave Search API is a new, independent web index that we want to add as an engine.

## Goals / Non-Goals

**Goals:**
- Add `brave` as a selectable engine in `searchWeb`.
- Support Brave's `X-Subscription-Token` header auth via a `search.brave.apiKey` config value.
- Map Brave's `web.results[].description` to the normalized `description` field.
- Plumb the API key through `runtimeOptions` and the `hasAnySearch` gate so the tool is enabled when a key is present.

**Non-Goals:**
- Brave's `llm/context` agentic-search endpoint.
- New npm dependencies.
- Changes to existing engines.

## Decisions

### Decision 1: Config surface is `apiKey` only
Brave's API requires a subscription token. We expose a single `apiKey` field under `search.brave`. The `count` parameter is hardcoded from the tool's `limit` input rather than a separate config value, matching the minimal surface described in the issue.

### Decision 2: Use `fetch` (Node 24+ global), no new dependency
Brave's search endpoint is a simple GET. The existing `fetch` global is sufficient — no new npm package. This matches the pattern used by other engines.

### Decision 3: Backend selection via explicit engine + inference chain
`detectSearchBackend()` already honors an explicit `search.engine` then falls back to inference. We add `"brave"` to the explicit-engine list and add `search?.brave?.apiKey` to the inference chain (before the `duckduckgo` fallback), consistent with how Tavily is handled.

### Decision 4: API key plumbing in `runtimeOptions` / `hasAnySearch`
Unlike Tavily/Firecrawl/Exa (which are vestigial), Brave is a brand-new engine. We add `searchBraveApiKey: search?.brave?.apiKey` to `runtimeOptions` and include it in the `hasAnySearch` gate so the tool is enabled when a Brave key is configured.

### Decision 5: Error handling
Non-2xx responses (e.g., 401, 429) return `{ ok: false, error }` with the status code. Empty results return `{ ok: true, results: [] }`. This mirrors the Tavily implementation.

## Risks / Trade-offs

- **API key exposure** → The key is passed only via the `X-Subscription-Token` header and never logged. Outbound URL validation is already enforced by `urlFilter`.
- **Rate limiting (429)** → Returned as `{ ok: false, error }`; the caller surfaces the error. No retry logic added (out of scope).
- **Response shape drift** → Brave's `web.results[].description` mapping is pinned by tests; if Brave changes the shape, tests will catch it.
