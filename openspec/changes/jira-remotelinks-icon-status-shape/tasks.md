# Tasks

## 1. Schema Update

- [ ] 1.1 Update the `icon` field in the `link` sub-object of `JiraInputSchema` to an object schema with optional string fields `url16x16`, `title`, and `link`, and verify `JiraInputSchema.safeParse` accepts an `icon` object and rejects a string
- [ ] 1.2 Update the `status` field in the `link` sub-object to an object schema with optional `resolved` (boolean) and nested `icon` (object), and verify `JiraInputSchema.safeParse` accepts a `status` object and rejects a string
- [ ] 1.3 Update the tool `description` string to describe `icon`/`status` as objects, and verify the description text references the object shapes

## 2. Request Builder

- [ ] 2.1 Confirm the `buildRequest` `remoteLinks` case passes `icon`/`status` objects through unchanged into `{ object }`, and verify the unit test asserting the POST body contains the object shapes passes

## 3. Tests

- [ ] 3.1 Update unit tests in `tests/unit/tools/jira.test.js` to cover `icon`/`status` as objects, including edge cases (fields omitted, partial objects), and verify `npm run test` passes for the jira unit suite
- [ ] 3.2 Update integration tests in `tests/integration/tools/jira.test.js` to cover the object shapes, and verify `npm run test` passes for the jira integration suite

## 4. Verification

- [ ] 4.1 Run `npm run test`, `npm run lint`, and `npm run coverage` and verify no regressions

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
