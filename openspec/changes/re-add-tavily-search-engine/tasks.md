## 1. Schema

- [ ] 1.1 Add `TavilySearchSchema` (`apiKey: z.string().optional().default("")`) to `src/config/schemas/providers.js`
- [ ] 1.2 Add `tavily: TavilySearchSchema.default({})` to `SearchConfigSchema`
- [ ] 1.3 Add `"tavily"` to the `engine` enum in `SearchConfigSchema`

## 2. Search Implementation

- [ ] 2.1 Add `searchWithTavily(apiKey, query, limit)` to `src/tools/web/index.js` that POSTs to `https://api.tavily.com/search` with `Authorization: Bearer <key>` and body `{ query, search_depth: "basic", max_results: limit }`
- [ ] 2.2 Map `results[].content` → `description` in `searchWithTavily`

## 3. Backend Wiring

- [ ] 3.1 Add `"tavily"` to the `detectSearchBackend` explicit-engine list
- [ ] 3.2 Add `search?.tavily?.apiKey` inference to `detectSearchBackend`
- [ ] 3.3 Add `const tavily = search?.tavily || {}` and `case "tavily"` in `searchWebImpl`

## 4. Tool Description

- [ ] 4.1 Add Tavily to the `searchWeb` tool description

## 5. Config

- [ ] 5.1 Add `tavily:` block with `apiKey: ""` under `search:` in `config.yaml`

## 6. Tests

- [ ] 6.1 Add `tests/unit/tools/web/searchTavily.test.js` (mocked fetch: request shape, content→description mapping, 401/429 errors, empty results)
- [ ] 6.2 Add a `detectSearchBackend` tavily case to `tests/unit/tools/web.test.js`

## 7. Verify

- [ ] 7.1 Run `npm run test`
- [ ] 7.2 Run `npm run lint`
- [ ] 7.3 Run `npm run coverage`
