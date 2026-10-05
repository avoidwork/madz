# Feature Goals: Re-add Firecrawl as a search engine option

## Goal 1
Re-add Firecrawl as a search engine option in the `searchWeb` tool.

### Scope
- Add Firecrawl as a selectable search backend alongside DuckDuckGo, Bing, SearXNG, Custom, and Tavily.
- Minimal config surface: `apiKey` only. Hardcode `sources: ["web"]` and derive `limit` from the tool's `limit` input.
- Out of scope: Firecrawl's full scrape capability (search only), any new npm packages.

### Key Requirements
1. Add a `FirecrawlSearchSchema` with `apiKey: z.string().optional().default("")`.
2. Add `firecrawl: FirecrawlSearchSchema.default({})` to `SearchConfigSchema`.
3. Implement `searchWithFirecrawl(apiKey, query, limit)` that POSTs to `https://api.firecrawl.dev/v2/search` with `Authorization: Bearer <key>` and body `{ query, limit, sources: ["web"] }`.
4. Map `data.web[].description` → the normalized `description` field.
5. Wire `"firecrawl"` into `detectSearchBackend` inference chain and `searchWebImpl` switch.
6. Add Firecrawl to the `searchWeb` tool description's built-in engines list.
7. Add a `firecrawl:` block with `apiKey: ""` under `search:` in `config.yaml`.

### Acceptance Criteria
- `searchWithFirecrawl("key", "query", 5)` POSTs to the Firecrawl v2 search endpoint with the correct body and Bearer auth.
- `data.web[].description` maps to the normalized `description` field.
- 401/408/500 responses return `{ ok: false, error }`.
- Empty results return `{ ok: true, results: [] }`.
- `detectSearchBackend({ search: { firecrawl: { apiKey: "key" } } })` returns `"firecrawl"`.
- `searchWebImpl` with a firecrawl backend returns a JSON string with `backend: "firecrawl"`.
- All existing tests, lint, and coverage pass.

### Dependencies
- `src/config/schemas/providers.js` — add schema.
- `src/tools/web/index.js` — add `searchWithFirecrawl`, wire backend.
- `config.yaml` — add `firecrawl:` block.
- `tests/unit/tools/web/searchFirecrawl.test.js` — new tests.

### Risks / Edge Cases
- API key must never be logged; passed only via `Authorization: Bearer` header.
- Outbound URL must pass the `urlFilter` allowlist (already enforced).
- Firecrawl may return results under `data.web[]`; handle missing/empty arrays gracefully.
- Clamp `limit` to 1–100.
