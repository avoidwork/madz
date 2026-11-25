# Tasks

## 1. Schema Update

- [ ] 1.1 Update `icon` in the `link` sub-object of `JiraInputSchema` in `src/tools/jira/index.js` to an object schema `{ url16x16?, title?, link? }` and verify the file parses (node --check)
- [ ] 1.2 Update `status` in the `link` sub-object of `JiraInputSchema` to an object schema `{ resolved?, icon? }` and verify the file parses (node --check)

## 2. Request Builder Verification

- [ ] 2.1 Confirm the `remoteLinks` case in `buildRequest` passes `icon`/`status` through unchanged into `object` and verify no code change is required there

## 3. Tests

- [ ] 3.1 Update the "creates a remote link with icon and status" unit test in `tests/unit/tools/jira.test.js` to assert `icon` and `status` are sent as objects and verify the test passes
- [ ] 3.2 Add edge-case tests for omitted `icon`/`status` and partial objects (e.g., `icon` with only `url16x16`, `status` with only `resolved`) and verify they pass

## 4. Verification

- [ ] 4.1 Run the jira unit test suite and lint, and verify no regressions
