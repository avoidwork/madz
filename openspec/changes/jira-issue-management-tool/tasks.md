# Tasks

## 1. Config Schema

- [ ] 1.1 Create `src/config/schemas/jira.js` with `JiraSchema` (baseUrl, credentials, allowlist, rateLimit, timeout) using the `ApiCredentialSchema` pattern and empty safe defaults, and verify it exports `JiraSchema`
- [ ] 1.2 Register `jira: JiraSchema.default({})` in `ConfigSchema` (`src/config/config.js`) and export `JiraSchema` from `src/config/schemas/index.js`, and verify `ConfigSchema.parse({})` succeeds with `jira` present
- [ ] 1.3 Verify no `DROPPED_KEYS` change is needed (the `jira` section name is the env prefix `JIRA_*`) and that `loadConfig()` succeeds with no `jira:` block

## 2. Tool Implementation

- [ ] 2.1 Create `src/tools/jira/index.js` with a Zod schema (`action` enum: search, get, create, update, delete, transition, comment, assign, projects, issueTypes, statuses, fields, users) and a `jiraImpl` implementation that dispatches by action, reusing `makeApiRequest` from `src/tools/api/index.js` for transport
- [ ] 2.2 Implement server-side credential resolution (Basic auth `email:token` from `JIRA_EMAIL`/`JIRA_TOKEN` via a named credential profile), with the `Authorization` header redacted from logs
- [ ] 2.3 Export `export const jira = tool((input, options = {}) => jiraImpl(input, options), { name: "jira", description, schema })` and verify the module exports `jira` as a LangChain tool
- [ ] 2.4 Add JSDoc comments to all public functions with `@param` and `@returns` and verify lint passes

## 3. Registry Wiring

- [ ] 3.1 Register `jira` in `src/tools/index.js`: import, `TOOLS` map, `TOOL_PERMISSIONS` (`network:outbound`), `TOOL_CLASSIFICATIONS` (mirroring `api`), and a `case "jira"` in `buildToolConfig()` that injects `config?.jira` as runtime policy, and verify the tool registers when `network:outbound` is enabled
- [ ] 3.2 Verify the `tool_index` guard test passes (any new `runtimeOptions` key must be added to `CONSUMED_RUNTIME_OPTION_KEYS`)

## 4. Unit Tests

- [ ] 4.1 Add `tests/unit/tools/jira.test.js` covering schema validation and mocked `makeApiRequest`/`fetch` calls for every action, plus error mapping for 400/401/404/429, and verify `npm run test` passes for the new test

## 5. Integration Test

- [ ] 5.1 Add `tests/integration/tools/jira.test.js` running search → get → create → transition → comment → update → assign → delete end-to-end against a mocked JIRA server, covering empty JQL, invalid keys, missing required fields, 429, and pagination, and verify `npm run test` passes for the new test

## 6. Verification

- [ ] 6.1 Run `npm run test` and verify all tests pass
- [ ] 6.2 Run `npm run lint` and verify it passes
- [ ] 6.3 Run `npm run coverage` and verify coverage is maintained

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
