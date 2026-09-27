## 1. Config Schema

- [ ] 1.1 Add `engine` field to `SearchConfigSchema` in `src/config/schemas/providers.js` with enum `["duckduckgo", "google", "bing", "searxng", "custom"]` defaulting to `duckduckgo`
- [ ] 1.2 Remove `exa`, `firecrawl`, `tavily`, and `parallel` sub-schemas from `SearchConfigSchema`

## 2. Web Tool Implementation

- [ ] 2.1 Update `detectSearchBackend()` in `src/tools/web/index.js` to honor `search.engine` first, before the inference chain
- [ ] 2.2 Implement `searchWithGoogle(query, limit)` (HTML scrape of `https://www.google.com/search`)
- [ ] 2.3 Add `case "google"` to the switch in `searchWebImpl()`
- [ ] 2.4 Update the `searchWeb` tool description to reflect the actual supported engines

## 3. Config

- [ ] 3.1 Update `config.yaml` `search:` section: add `engine: duckduckgo`, `duckduckgo:` block, and `google:` block; remove `exa`, `firecrawl`, `tavily`, and `parallel` blocks

## 4. Tests

- [ ] 4.1 Add `tests/unit/tools/web.test.js` covering `detectSearchBackend()` for each config combination and the explicit `engine` override

## 5. Verification

- [ ] 5.1 Run `npm run test` and confirm all tests pass
- [ ] 5.2 Run `npm run lint` and confirm no lint errors
- [ ] 5.3 Run `npm run coverage` and confirm coverage is maintained
