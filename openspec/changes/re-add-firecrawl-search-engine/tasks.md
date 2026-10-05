## 1. Schema

- [ ] 1.1 Add `FirecrawlSearchSchema` (`apiKey: z.string().optional().default("")`) to `src/config/schemas/providers.js`
- [ ] 1.2 Add `firecrawl: FirecrawlSearchSchema.default({})` to `SearchConfigSchema`

## 2. Implementation

- [ ] 2.1 Add `searchWithFirecrawl(apiKey, query, limit)` to `src/tools/web/index.js` that POSTs to `https://api.firecrawl.dev/v2/search` with `Authorization: Bearer <key>` and body `{ query, limit, sources: ["web"] }`, mapping `data.web[].description` to the normalized `description` field
- [ ] 2.2 Add `if (search?.firecrawl?.apiKey) return "firecrawl";` to `detectSearchBackend()` inference chain
- [ ] 2.3 Add `const firecrawl = search?.firecrawl || {};` and `case "firecrawl":` to `searchWebImpl()` switch

## 3. Description & Config

- [ ] 3.1 Add Firecrawl to the `searchWeb` tool description's built-in engines list
- [ ] 3.2 Add a `firecrawl:` block with `apiKey: ""` under `search:` in `config.yaml`

## 4. Tests

- [ ] 4.1 Add `tests/unit/tools/web/searchFirecrawl.test.js` with mocked fetch: request shape, `data.web[].description` mapping, 401/408/500 errors, empty results, limit clamping
- [ ] 4.2 Add a `detectSearchBackend` firecrawl case

## 5. Verification

- [ ] 5.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm no regressions
