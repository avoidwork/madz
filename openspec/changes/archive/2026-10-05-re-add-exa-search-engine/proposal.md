## Why

Exa was removed in PR #1193 (commit `7f14855f`) as part of clearing dead engine config (exa, firecrawl, tavily, parallel). However, Exa's `/search` endpoint offers neural + keyword search with `type: "auto"` (balanced), `fast`, `instant`, and `deep` modes, plus domain filtering and content extraction. Re-adding it restores a genuinely useful search capability that was removed as dead config but is not dead.

## What Changes

- Add an `ExaSearchSchema` (`apiKey` field) to `SearchConfigSchema` in `src/config/schemas/providers.js`.
- Add `"exa"` to the `engine` enum.
- Implement `searchWithExa(apiKey, query, limit)` in `src/tools/web/index.js` that POSTs to `https://api.exa.ai/search` with `x-api-key` header and body `{ query, type: "auto", numResults: limit }`.
- Wire `"exa"` into `detectSearchBackend` explicit-engine list and the inference chain.
- Add `case "exa"` to `searchWebImpl()`.
- Add Exa to the `searchWeb` tool description.
- Add an `exa:` block with `apiKey: ""` under `search:` in `config.yaml`.
- Add `tests/unit/tools/web/searchExa.test.js` and a `detectSearchBackend` exa case.

## Capabilities

### New Capabilities
- `exa-search`: Exa search engine integration — config schema, backend implementation, backend selection, and tool description.

### Modified Capabilities
- `web-search-config`: The existing spec currently requires that `exa`, `firecrawl`, and `parallel` be absent from the schema, config.yaml, and tool description. This change reverses that for `exa` only — it must now be present in the schema enum, config.yaml, and tool description.

## Impact

- `src/config/schemas/providers.js` — add `ExaSearchSchema`, `exa` key, and `"exa"` enum value.
- `src/tools/web/index.js` — add `searchWithExa`, wire backend selection, add `case "exa"`.
- `config.yaml` — add `exa:` block.
- `tests/unit/tools/web/searchExa.test.js` — new test file.
- No new npm packages; uses existing `fetch` (Node 24+ global).

## Non-goals

- No support for Exa's `deep`/`deep-reasoning` modes — this is search only.
- No changes to the other removed engines (`firecrawl`, `parallel`).
- No new npm dependencies.
