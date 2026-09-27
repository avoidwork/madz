## Context

The `searchWeb` tool in `src/tools/web/index.js` infers its backend from config via `detectSearchBackend()` using a priority chain: custom > bing > searxng > duckduckgo. There is no way for a user to explicitly choose an engine. The `SearchConfigSchema` in `src/config/schemas/providers.js` declares sub-schemas for `exa`, `firecrawl`, `tavily`, `parallel`, `searxng`, `bing`, and `custom`, but only `bing`, `searxng`, `custom`, and the implicit `duckduckgo` are actually wired into `searchWebImpl()`. Google is referenced in the tool description and the priority comment but has no implementation.

## Goals / Non-Goals

**Goals:**
- Add an explicit `engine` selector to `SearchConfigSchema`, defaulting to `duckduckgo`.
- Have `detectSearchBackend()` honor `search.engine` before the inference chain.
- Make `config.yaml` list every search engine's config values explicitly, including DuckDuckGo and a new `google:` block.
- Implement `searchWithGoogle(query, limit)` and wire `case "google"` into `searchWebImpl()`.
- Remove the declared-but-unimplemented engines (`exa`, `firecrawl`, `tavily`, `parallel`) to eliminate dead config.
- Update the stale "Google" reference in the `searchWeb` tool description.
- Add tests for `detectSearchBackend()` covering each config combination and the explicit `engine` override.

**Non-Goals:**
- Implementing the `exa`, `firecrawl`, `tavily`, or `parallel` engines.
- Adding new config sections beyond the `search:` section.
- Changing the `extractWeb` tool.

## Decisions

### Decision 1: Remove exa/firecrawl/tavily/parallel rather than implement them

These four engines are declared in `SearchConfigSchema` and `config.yaml` but never wired into `searchWebImpl()`, have no tests, and would require significant new external integrations with API keys that are not configured. Keeping them would be dead config, violating YAGNI. **Decision:** remove them from `SearchConfigSchema` and `config.yaml`.

**Alternatives considered:**
- *Implement all four engines* — rejected because it requires four new external API integrations, API keys, and tests, with no existing usage. High cost, low value.
- *Keep them as declared-but-unimplemented* — rejected because it leaves dead config and contradicts the issue's explicit goal to avoid dead config.

### Decision 2: Google via HTML scrape (no API key) as the default

`searchWithGoogle(query, limit)` scrapes `https://www.google.com/search` and parses results. This requires no credentials and works out of the box, matching the pattern of the existing `searchWithDuckDuckGo` HTML scrape. The Custom Search JSON API (requires `apiKey` and `cx`) is noted as an alternative but not required for the default path.

**Alternatives considered:**
- *Custom Search JSON API* — rejected as the default because it requires an API key and a Search Engine ID (CX), which are not configured. HTML scrape works with zero config.

### Decision 3: Enum lists only implemented engines

The `engine` enum in `SearchConfigSchema` lists only `duckduckgo`, `google`, `bing`, `searxng`, and `custom` — the engines actually wired into `searchWebImpl()`. This keeps the schema and the switch in sync.

## Risks / Trade-offs

- **[Google HTML scrape may be blocked or return no results]** → Mitigation: `searchWithGoogle` returns `{ ok: false, error: "Google search failed" }` on failure, matching the pattern of other engines. The tool surfaces the error to the caller.
- **[Removing engines could break existing config]** → Mitigation: The removed engines (`exa`, `firecrawl`, `tavily`, `parallel`) were never wired into `searchWebImpl()`, so removing them from the schema and config has no runtime effect. The `engine` enum default (`duckduckgo`) preserves current behavior.
- **[`engine` set to an unsupported value]** → Mitigation: `detectSearchBackend()` validates `search.engine` against the supported set and falls back to the inference chain if it is not supported.
