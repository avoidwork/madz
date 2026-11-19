# Tasks

## 1. Input schema

- [x] 1.1 Add `components`, `labels`, `priority`, and `fields` inputs to `JiraInputSchema` in `src/tools/jira/index.js`, and verify the schema parses them and still rejects unknown fields (unit test in `tests/unit/tools/jira.test.js`)

## 2. Request body

- [x] 2.1 Extend the `create` branch of `buildRequest` to map `components`/`labels`/`priority` to their Jira field shapes and merge the generic `fields` record, with typed inputs taking precedence, and verify the emitted body via a unit test asserting the exact JSON sent

## 3. Tool description

- [x] 3.1 Update the `jira` tool description to document the new create inputs (components, labels, priority, and arbitrary fields via `fields`, including the epic link custom field), and verify the description text is present

## 4. Integration coverage

- [x] 4.1 Extend the in-memory Jira mock and the integration lifecycle test in `tests/integration/tools/jira.test.js` to create an issue with components, labels, priority, and a custom field, and verify the fields round-trip

## 5. Verification

- [x] 5.1 Run `npm run lint` and the jira unit + integration tests, and verify all pass

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
