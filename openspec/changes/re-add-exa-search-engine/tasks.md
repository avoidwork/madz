## 1. Config Schema

- [ ] 1.1 Add `ExaSearchSchema` with `apiKey: z.string().optional().default("")` to `src/config/schemas/providers.js`
- [ ] 1.2 Add `exa: ExaSearchSchema.default({})` to `SearchConfigSchema`
- [ ] 1.3 Add `"exa"` to the `engine` enum in `src/config/schemas/providers.js`

## 2. Exa Backend Implementation

- [ ] 2.1 Add `searchWithExa(apiKey, query, limit)` to `src/tools/web/index.js` that POSTs to `https://api.exa.ai/search` with `x-api-key` header and body `{ query, type: "auto", numResults: limit }`
- [ ] 2.2 Map `results[].text` or `results[].highlights[0]` to the normalized `description` field
- [ ] 2.3 Handle 401/402/429 errors and empty results

## 3. Backend Selection Wiring

- [ ] 3.1 Add `"exa"` to the `detectSearchBackend` explicit-engine list (line 277)
- [ ] 3.2 Add `search?.exa?.apiKey` to the inference chain before the `duckduckgo` fallback
- [ ] 3.3 Add `const exa = search?.exa || {}` and `case "exa"` in `searchWebImpl()`

## 4. Tool Description & Config

- [ ] 4.1 Add Exa to the `searchWeb` tool description's built-in engines list (line 510)
- [ ] 4.2 Add `exa:` block with `apiKey: ""` under `search:` in `config.yaml`

## 5. Tests

- [ ] 5.1 Add `tests/unit/tools/web/searchExa.test.js` with mocked fetch: request shape, `results[].text`/`highlights` mapping, 401/402/429 errors, empty results
- [ ] 5.2 Add a `detectSearchBackend` exa case test

## 6. Verification

- [ ] 6.1 Run `npm run test` and confirm all tests pass
- [ ] 6.2 Run `npm run lint` and confirm no lint errors
- [ ] 6.3 Run `npm run coverage` and confirm coverage is maintained
