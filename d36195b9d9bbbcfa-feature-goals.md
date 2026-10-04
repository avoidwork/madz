# Feature Goals — Re-add Tavily as a search engine option

## Goal 1: Add Tavily to the search config schema
- **Goal:** Re-add Tavily as a first-class, configurable search engine in the config schema.
- **Scope:** Only `src/config/schemas/providers.js`. No changes to loader (already maps `search.tavily.apiKey` → `TAVILY_API_KEY`).
- **Key Requirements:**
  1. Add `TavilySearchSchema` with `apiKey: z.string().optional().default("")`.
  2. Add `tavily: TavilySearchSchema.default({})` to `SearchConfigSchema`.
  3. Add `"tavily"` to the `engine` enum (currently `["duckduckgo", "bing", "searxng", "custom"]`).
- **Acceptance Criteria:** `SearchConfigSchema` accepts `engine: "tavily"` and a `tavily` sub-object with an `apiKey` field defaulting to `""`.
- **Dependencies:** Existing `SearchConfigSchema` in `src/config/schemas/providers.js`.
- **Risks / Edge Cases:** The `engine` enum is validated by zod; adding `"tavily"` must not break existing engine values.

## Goal 2: Implement `searchWithTavily`
- **Goal:** Add a Tavily search implementation that POSTs to the Tavily API and normalizes results.
- **Scope:** `src/tools/web/index.js`.
- **Key Requirements:**
  1. `searchWithTavily(apiKey, query, limit)` POSTs to `https://api.tavily.com/search`.
  2. Headers: `Authorization: Bearer <apiKey>`, `Content-Type: application/json`.
  3. Body: `{ query, search_depth: "basic", max_results: limit }`.
  4. Map `results[].content` → `description`, with `title` and `url` fallbacks.
  5. Use `AbortController` + `FETCH_TIMEOUT` consistent with other engines.
  6. Return `{ ok: true, results }` on success, `{ ok: false, error }` on non-2xx or failure.
- **Acceptance Criteria:** `searchWithTavily` builds the correct request shape and maps `content` → `description`.
- **Dependencies:** Existing `fetch`-based engine pattern (Bing/SearXNG/Custom).
- **Risks / Edge Cases:** Missing/empty API key, 401/429 non-2xx responses, empty results array, `limit` clamping.

## Goal 3: Wire Tavily into backend detection and dispatch
- **Goal:** Make `detectSearchBackend` and `searchWebImpl` route to Tavily.
- **Scope:** `src/tools/web/index.js`.
- **Key Requirements:**
  1. Add `"tavily"` to the explicit-engine list in `detectSearchBackend`.
  2. Add `search?.tavily?.apiKey` inference to the chain (before duckduckgo fallback).
  3. Add `const tavily = search?.tavily || {}` and `case "tavily"` in `searchWebImpl`.
- **Acceptance Criteria:** `detectSearchBackend({ search: { engine: "tavily" } })` returns `"tavily"`; `searchWebImpl` routes to `searchWithTavily` when backend is `"tavily"`.
- **Dependencies:** `searchWithTavily` (Goal 2).
- **Risks / Edge Cases:** Inference chain ordering — Tavily should be inferred when `tavily.apiKey` is set.

## Goal 4: Update `searchWeb` tool description
- **Goal:** List Tavily as a supported engine in the `searchWeb` description.
- **Scope:** `src/tools/web/index.js` (line ~510).
- **Key Requirements:** Add Tavily to the `Built-in engines:` list.
- **Acceptance Criteria:** Description mentions Tavily and its requirement (TAVILY_API_KEY).
- **Dependencies:** None.

## Goal 5: Update config.yaml
- **Goal:** Add a `tavily:` block under `search:`.
- **Scope:** `config.yaml`.
- **Key Requirements:** Add `tavily:` with `apiKey: ""`.
- **Acceptance Criteria:** `config.yaml` has a `search.tavily.apiKey` entry.
- **Dependencies:** None.

## Goal 6: Add tests
- **Goal:** Add unit tests for `searchWithTavily` and the Tavily `detectSearchBackend` path.
- **Scope:** `tests/unit/tools/web/searchTavily.test.js` (new) and `tests/unit/tools/web.test.js` (detectSearchBackend case).
- **Key Requirements:**
  1. Mocked `fetch` verifying request shape (POST, Bearer auth, body).
  2. `content` → `description` mapping.
  3. 401/429 error handling.
  4. Empty results array.
  5. `detectSearchBackend` returns `"tavily"` when engine is `"tavily"` and when `tavily.apiKey` is set.
- **Acceptance Criteria:** New tests pass and existing tests (tool_index, tool_registration) still pass.
- **Dependencies:** `searchWithTavily` and `detectSearchBackend` exports.
- **Risks / Edge Cases:** Mocking `fetch` must be restored; env cleanup for `TAVILY_API_KEY`.

## Goal 7: Verify
- **Goal:** Run test, lint, and coverage to confirm no regressions.
- **Scope:** `npm run test`, `npm run lint`, `npm run coverage`.
- **Acceptance Criteria:** All pass.
- **Dependencies:** All implementation goals.
