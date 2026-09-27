## Why

The `searchWeb` tool currently infers the backend from config (custom > bing > searxng > duckduckgo) with no way to explicitly choose an engine. The config schema and `config.yaml` already declare several engines (`exa`, `firecrawl`, `tavily`, `parallel`) that are not implemented, and Google is referenced in the tool description and priority comment but has no implementation. Users need explicit control over which engine is used, and a clear, complete list of supported engines.

## What Changes

- Add an explicit `engine` field to `SearchConfigSchema` (`src/config/schemas/providers.js`) with an enum of supported engines, defaulting to `duckduckgo`.
- Have `detectSearchBackend()` (`src/tools/web/index.js`) honor `search.engine` first, before the inference chain (custom > bing > searxng > duckduckgo).
- Make `config.yaml` list every search engine's config values explicitly, including the currently-implicit DuckDuckGo and a new `google:` block.
- Implement `searchWithGoogle(query, limit)` (HTML scrape of `https://www.google.com/search`) and add a `case "google"` to the switch in `searchWebImpl()`.
- Remove the declared-but-unimplemented engines (`exa`, `firecrawl`, `tavily`, `parallel`) from `SearchConfigSchema` and `config.yaml` to eliminate dead config.
- Update the stale "Google" reference in the `searchWeb` tool description to reflect the actual supported engines.
- Add tests covering `detectSearchBackend()` for each config combination and the explicit `engine` override.

## Capabilities

### New Capabilities
- `web-search-config`: The explicit search engine selector, explicit config.yaml values for every engine, Google search implementation, and removal of dead engine config.

### Modified Capabilities
<!-- No existing spec-level behavior changes. -->

## Impact

- **Modified**: `src/config/schemas/providers.js` — add `engine` field, remove `exa`/`firecrawl`/`tavily`/`parallel` sub-schemas.
- **Modified**: `src/tools/web/index.js` — honor `search.engine`, implement `searchWithGoogle`, add `case "google"`, update tool description.
- **Modified**: `config.yaml` — add `engine`, `duckduckgo`, and `google` blocks; remove `exa`/`firecrawl`/`tavily`/`parallel` blocks.
- **New**: `tests/unit/tools/web.test.js` — tests for `detectSearchBackend()`.

## Non-goals

- Implementing the `exa`, `firecrawl`, `tavily`, or `parallel` engines (removed instead).
- Adding new config sections beyond the `search:` section.
- Changing the `extractWeb` tool.
