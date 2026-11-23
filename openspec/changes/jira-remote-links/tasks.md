# Tasks

## 1. Implement the remoteLinks action

- [ ] 1.1 Add `remoteLinks` to the `JIRA_ACTIONS` array in `src/tools/jira/index.js` and verify the action enum accepts it (unit test for the action passes)
- [ ] 1.2 Add `remoteLinks: ["key"]` to `REQUIRED_FIELDS` and verify a missing `key` returns a required-field error without sending a request
- [ ] 1.3 Add a `case "remoteLinks"` to `buildRequest()` that issues a GET to `/issue/<key>/remotelink` when no `link` is given and a POST with `{ object: { url, title, icon?, status? } }` when a `link` is given, and verify the request method/path/body via unit tests
- [ ] 1.4 Extend `JiraInputSchema` with an optional `link` sub-object (`url` and `title` required, `icon` and `status` optional) and verify a `link` missing `url` or `title` is rejected by the schema
- [ ] 1.5 Update the `jira` tool `description` string to advertise the `remoteLinks` action and verify it is present

## 2. Tests

- [ ] 2.1 Add unit tests in `tests/unit/tools/jira.test.js` covering read (GET to `/remotelink`), create (POST with `{ object: { url, title } }`), missing `key`, and schema rejection of a `link` without `url`/`title`, and verify `npm run test` passes
- [ ] 2.2 Add a mock route for `/rest/api/2/issue/:key/remotelink` and a create-then-read round-trip case in `tests/integration/tools/jira.test.js`, and verify the integration test passes

## 3. Verification

- [ ] 3.1 Run `npm run test`, `npm run lint`, and `npm run coverage` and verify all pass with no regressions

## Workflow follow-up

- Commit and push the implementation to the open PR.
- Archive the OpenSpec change after review.
- Update the PR title and description.
- Post audit results as a PR comment.
