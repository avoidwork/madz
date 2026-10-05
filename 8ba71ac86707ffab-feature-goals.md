# Feature Goals: Re-add Exa as a search engine option

## Goal 1: Add Exa search engine config schema
- **Goal:** Re-add Exa as a search engine option in the `searchWeb` tool.
- **Scope:** Add `apiKey` config surface only. Hardcode `type: "auto"` and `numResults` from the tool's `limit` input. No new npm packages.
- **Key Requirements:**
  - Add `ExaSearchSchema` with `apiKey: z.string().optional().default("")` in `src/config/schemas/providers.js`.
  - Add `exa: ExaSearchSchema.default({})` to `SearchConfigSchema`.
  - Add `"exa"` to the `engine` enum at line 50.
- **Acceptance Criteria:** The `search.exa.apiKey` config validates and the `engine` enum accepts `"exa"`.
- **Dependencies:** `src/config/schemas/providers.js`.
- **Risks / Edge Cases:** Ensure no conflict with existing engine values.

## Goal 2: Implement Exa search backend
- **Goal:** Implement `searchWithExa(apiKey, query, limit)` that POSTs to `https://api.exa.ai/search`.
- **Scope:** Use `x-api-key: <key>` header, body `{ query, type: "auto", numResults: limit }`. Map `results[].text` or `results[].highlights[0]` → normalized `description` field.
- **Key Requirements:**
  - Add `searchWithExa` in `src/tools/web/index.js`.
  - Use existing `fetch` (Node 24+ global).
  - Map results to the same normalized shape as other backends.
- **Acceptance Criteria:** Exa search returns normalized results matching the other search backends' shape.
- **Dependencies:** `src/tools/web/index.js`.
- **Risks / Edge Cases:** Handle 401/402/429 errors, empty results, and missing `text`/`highlights`.

## Goal 3: Wire Exa into backend selection
- **Goal:** Add `"exa"` to `detectSearchBackend` explicit-engine list and the inference chain.
- **Scope:** Add `search?.exa?.apiKey` inference before the `duckduckgo` fallback. Add `const exa = search?.exa || {}` and `case "exa"` in `searchWebImpl`.
- **Key Requirements:**
  - Line 277 explicit-engine check includes `"exa"`.
  - `case "exa"` in the `switch (backend)` block calls `searchWithExa(exa.apiKey, query, clampedLimit)`.
- **Acceptance Criteria:** When `engine: "exa"` (or `search.exa.apiKey` set), the Exa backend is selected.
- **Dependencies:** `src/tools/web/index.js`.
- **Risks / Edge Cases:** Ensure the inference chain doesn't break existing backends.

## Goal 4: Update searchWeb tool description
- **Goal:** Add Exa to the `Built-in engines:` list in the `searchWeb` tool description (line 510).
- **Scope:** Documentation-only change to the tool description.
- **Key Requirements:** Include `"exa"` in the list.
- **Acceptance Criteria:** The tool description lists Exa.
- **Dependencies:** `src/tools/web/index.js`.
- **Risks / Edge Cases:** None.

## Goal 5: Update config.yaml
- **Goal:** Add `exa:` block with `apiKey: ""` under `search:` in `config.yaml`.
- **Scope:** Config file change.
- **Key Requirements:** Add `exa:` sub-block with `apiKey: ""`.
- **Acceptance Criteria:** `config.yaml` has the `search.exa.apiKey` key.
- **Dependencies:** `config.yaml`.
- **Risks / Edge Cases:** None.

## Goal 6: Write tests
- **Goal:** Add `tests/unit/tools/web/searchExa.test.js` and a `detectSearchBackend` exa case.
- **Scope:** Mocked fetch: request shape, `results[].text`/`highlights` mapping, 401/402/429 errors, empty results.
- **Key Requirements:**
  - Test request shape (URL, headers, body).
  - Test `results[].text` and `highlights[0]` mapping.
  - Test 401/402/429 error handling.
  - Test empty results.
  - Test `detectSearchBackend` exa case.
- **Acceptance Criteria:** All tests pass; coverage maintained.
- **Dependencies:** `tests/unit/tools/web/`, `src/tools/web/index.js`.
- **Risks / Edge Cases:** Mock fetch correctly; follow existing test conventions.

## Goal 7: Verify
- **Goal:** Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm no regressions.
- **Scope:** Full verification.
- **Key Requirements:** All tests pass, lint passes, coverage maintained.
- **Acceptance Criteria:** No regressions.
- **Dependencies:** None.
- **Risks / Edge Cases:** None.
