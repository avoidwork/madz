# Tasks

## 1. Discovery module

- [ ] 1.1 Create `src/tools/poppy/discovery.js` with fetch logic (HTTPS-only, redirect rules, timeout) and verify unit tests cover redirect and non-HTTPS cases
- [ ] 1.2 Add Zod schema for `poppy.json` validation (required fields, URL/address checks) and verify unit tests cover missing-field and malformed-JSON cases
- [ ] 1.3 Add domain-match check (case-insensitive) and verify unit tests cover mismatch rejection
- [ ] 1.4 Add normalization and per-domain LRU cache with TTL, plus `supported_versions` selection, and verify unit tests cover caching and version selection

## 2. Tool registration

- [ ] 2.1 Create `src/tools/poppy/index.js` with the LangChain `tool()` instance and Zod input schema, and verify it exports a `poppy` tool
- [ ] 2.2 Register `poppy` in `src/tools/index.js` (`TOOL_PERMISSIONS` with `network:outbound`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, `TOOLS`) and verify the tool_index guard test passes

## 3. Tests

- [ ] 3.1 Create `tests/unit/tools/poppy/discovery.test.js` covering parsing, validation, domain matching, HTTPS/address checks, redirect handling, version selection, and verify `npm run test` passes
- [ ] 3.2 Create `tests/integration/tools/poppy/discovery.test.js` fetching a fixture from a local HTTPS server and verify the normalized output

## 4. Verify

- [ ] 4.1 Run `npm run test`
- [ ] 4.2 Run `npm run lint`
- [ ] 4.3 Run `npm run coverage`

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
