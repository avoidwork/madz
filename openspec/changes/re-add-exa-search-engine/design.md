## Context

The `searchWeb` tool supports multiple search backends selected via `detectSearchBackend()`. Exa was removed in PR #1193 as dead config, but its `/search` endpoint provides neural + keyword search that is genuinely useful. The current `web-search-config` spec explicitly requires `exa` to be absent from the schema, config.yaml, and tool description — this change reverses that for `exa` only.

## Goals / Non-Goals

**Goals:**
- Re-add Exa as a selectable search engine with a minimal `apiKey` config surface.
- Implement `searchWithExa(apiKey, query, limit)` using the existing `fetch` global.
- Wire `"exa"` into `detectSearchBackend` and `searchWebImpl`.
- Update the `web-search-config` spec to reflect Exa as an implemented engine.

**Non-Goals:**
- No support for Exa's `deep`/`deep-reasoning` modes.
- No changes to `firecrawl` or `parallel` (still removed).
- No new npm dependencies.

## Decisions

### Decision 1: Minimal config surface — `apiKey` only
Exa's API requires an API key. We expose only `apiKey`, hardcoding `type: "auto"` and deriving `numResults` from the tool's `limit` input. This keeps the config surface minimal and avoids over-configuring a single backend. Alternative considered: exposing `type` and domain filters — rejected as YAGNI for this change.

### Decision 2: Use existing `fetch` global, no new dependency
Node 24+ provides a global `fetch`. Exa's `/search` endpoint is a simple POST. No new npm package needed. Alternative considered: adding an `exa` SDK — rejected as unnecessary weight.

### Decision 3: Map `results[].text` or `results[].highlights[0]` → `description`
Exa returns results with `text` and optionally `highlights`. We normalize to the same `{ title, url, description }` shape used by other backends, preferring `text` and falling back to `highlights[0]`.

### Decision 4: Add `"exa"` to explicit-engine list and inference chain
`detectSearchBackend` uses an explicit `engine` field first, then infers from configured credentials. We add `"exa"` to the explicit list and add `search?.exa?.apiKey` to the inference chain before the `duckduckgo` fallback.

## Risks / Trade-offs

- [Exa API key required] → If no key is configured, the inference chain falls through to `duckduckgo`; the explicit `engine: "exa"` path requires a key and will error if missing.
- [Rate limits / 401/402/429] → `searchWithExa` surfaces these as `{ ok: false, error }` like other backends; tests cover these cases.
- [Spec reversal] → The `web-search-config` spec must be updated to remove the "exa absent" requirement and add an "exa present" requirement, or the archive validation will fail.
