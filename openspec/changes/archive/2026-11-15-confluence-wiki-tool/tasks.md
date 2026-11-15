# Tasks

## 1. Config Schema

- [x] 1.1 Create `src/config/schemas/confluence.js` with `ConfluenceSchema` (baseUrl, credentials, allowlist, rateLimit, timeout) using the `JiraCredentialSchema` pattern and empty safe defaults, and verify it exports `ConfluenceSchema`
- [x] 1.2 Register `confluence: ConfluenceSchema.default({})` in `ConfigSchema` (`src/config/config.js`) and export `ConfluenceSchema` from `src/config/schemas/index.js`, and verify `ConfigSchema.parse({})` succeeds with `confluence` present
- [x] 1.3 Verify no `DROPPED_KEYS` change is needed (the `confluence` section name is the env prefix `CONFLUENCE_*`) and that `loadConfig()` succeeds with no `confluence:` block

## 2. Tool Implementation

- [x] 2.1 Create `src/tools/confluence/index.js` with a Zod schema (`action` enum: search, get, create, update, delete, spaces, pages, labels, attachments) and a `confluenceImpl` implementation that dispatches by action, reusing `makeApiRequest` from `src/tools/api/index.js` for transport
- [x] 2.2 Implement server-side credential resolution (Basic auth `email:token` from `CONFLUENCE_EMAIL`/`CONFLUENCE_TOKEN` via a named credential profile), with the `Authorization` header redacted from logs
- [x] 2.3 Export `export const confluence = tool((input, options = {}) => confluenceImpl(input, options), { name: "confluence", description, schema })` and verify the module exports `confluence` as a LangChain tool
- [x] 2.4 Add JSDoc comments to all public functions with `@param` and `@returns` and verify lint passes

## 3. Registry Wiring

- [x] 3.1 Register `confluence` in `src/tools/index.js`: import, `TOOLS` map, `TOOL_PERMISSIONS` (`network:outbound`), `TOOL_CLASSIFICATIONS` (mirroring `api`/`jira`), and a `case "confluence"` in `buildToolConfig()` that injects `config?.confluence` as runtime policy, and verify the tool registers when `network:outbound` is enabled
- [x] 3.2 Verify the `tool_index` guard test passes (no new `runtimeOptions` key added, so `CONSUMED_RUNTIME_OPTION_KEYS` is unchanged)

## 4. Unit Tests

- [x] 4.1 Add `tests/unit/tools/confluence.test.js` covering schema validation and mocked `makeApiRequest`/`fetch` calls for every action, plus error mapping for 400/401/404/429, and verify `npm run test` passes for the new test

## 5. Integration Test

- [x] 5.1 Add `tests/integration/tools/confluence.test.js` running search → get → create → update → delete end-to-end against a mocked Confluence server, covering empty search results, invalid page ids, missing required fields, 429, and pagination, and verify `npm run test` passes for the new test

## 6. Verification

- [x] 6.1 Run `npm run test` and verify all tests pass
- [x] 6.2 Run `npm run lint` and verify it passes
- [x] 6.3 Run `npm run coverage` and verify coverage is maintained

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
