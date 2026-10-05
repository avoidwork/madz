## 1. Config Schema

- [ ] 1.1 Add `BraveSearchSchema` with `apiKey: z.string().optional().default("")` to `src/config/schemas/providers.js`
- [ ] 1.2 Add `brave: BraveSearchSchema.default({})` to `SearchConfigSchema`
- [ ] 1.3 Add `"brave"` to the `engine` enum in `SearchConfigSchema`

## 2. Search Implementation

- [ ] 2.1 Add `searchWithBrave(apiKey, query, limit)` to `src/tools/web/index.js` that GETs `https://api.search.brave.com/res/v1/web/search` with `X-Subscription-Token: <key>` header and params `{ q: query, count: limit }`, mapping `web.results[].description` to `description`
- [ ] 2.2 Add `"brave"` to the `detectSearchBackend` explicit-engine list and the inference chain (`search?.brave?.apiKey`)
- [ ] 2.3 Add `const brave = search?.brave || {}` and `case "brave"` in `searchWebImpl` switch

## 3. API Key Plumbing

- [ ] 3.1 Add `searchBraveApiKey: search?.brave?.apiKey` to `runtimeOptions` in `src/tools/index.js`
- [ ] 3.2 Include `searchBraveApiKey` in the `hasAnySearch` gate in `src/tools/index.js`

## 4. Config & Description

- [ ] 4.1 Add `brave:` block with `apiKey: ""` under `search:` in `config.yaml`
- [ ] 4.2 Add Brave to the `searchWeb` tool description in `src/tools/web/index.js`

## 5. Tests

- [ ] 5.1 Add `tests/unit/tools/web/searchBrave.test.js` — mocked fetch: request shape, `web.results[].description` mapping, 401/429 errors, empty results
- [ ] 5.2 Add a `detectSearchBackend` brave case test

## 6. Verification

- [ ] 6.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm no regressions
