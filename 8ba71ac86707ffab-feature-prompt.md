CHANGE_NAME: re-add-exa-search-engine

## Summary

Re-add **Exa** as a search engine option in the `searchWeb` tool. Exa was removed in PR #1193 (commit `7f14855f`) as part of clearing dead engine config (exa, firecrawl, tavily, parallel). This change restores Exa as a genuinely useful search backend.

## Technical Approach

### Config surface

Minimal — `apiKey` only. Hardcode `type: "auto"` and `numResults` from the tool's `limit` input. No new npm packages; use the existing `fetch` (Node 24+ global).

### Schema (`src/config/schemas/providers.js`)

Add an `ExaSearchSchema` with `apiKey: z.string().optional().default("")`, add `exa: ExaSearchSchema.default({})` to `SearchConfigSchema`, and add `"exa"` to the `engine` enum at line 50.

### Implementation (`src/tools/web/index.js`)

Add `searchWithExa(apiKey, query, limit)` that POSTs to `https://api.exa.ai/search` with `x-api-key: <key>` header and body `{ query, type: "auto", numResults: limit }`. Map `results[].text` or `results[].highlights[0]` → the normalized `description` field.

### Backend selection

Add `"exa"` to the `detectSearchBackend` explicit-engine list (line 277) and the inference chain (`search?.exa?.apiKey`) before the `duckduckgo` fallback. Add `const exa = search?.exa || {}` and `case "exa"` in `searchWebImpl`.

### Config

Add `exa:` block with `apiKey: ""` under `search:` in `config.yaml`.

## Testing

- `tests/unit/tools/web/searchExa.test.js` — mocked fetch: request shape, `results[].text`/`highlights` mapping, 401/402/429 errors, empty results.
- `detectSearchBackend` exa case.

## Security Considerations

- API key passed via `x-api-key` header, never logged.
- Validate outbound URL against the allowlist (already enforced by `urlFilter`).
- Strip PII from any logged response.
