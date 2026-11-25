# Proposal

## Why

The `jira` tool's `remoteLinks` action sends `icon` and `status` as plain strings, but the Jira Data Center REST API v2 remote-link schema defines both as objects. The payload therefore does not match the documented API, so remote links with icons or statuses are malformed.

## What Changes

- Change `icon` in the `link` sub-object of `JiraInputSchema` from `z.string().optional()` to an object schema `{ url16x16, title, link }` (all optional).
- Change `status` in the `link` sub-object from `z.string().optional()` to an object schema `{ resolved, icon }` (all optional).
- Ensure the `remoteLinks` case in `buildRequest` passes `icon`/`status` through unchanged into the POST body `{ object }`.
- Update the unit test to assert `icon` and `status` are sent as objects conforming to the API schema, plus edge cases (omitted fields, partial objects).
- The core create/list flow (`url` + `title`) is unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-tool`: The `JIRA remote link creation` requirement changes so the optional `icon` and `status` fields are sent as objects matching the Jira Data Center REST API v2 remote-link schema, not as plain strings.

## Impact

- `src/tools/jira/index.js` — `JiraInputSchema` `link` sub-object and the `remoteLinks` case in `buildRequest`.
- `tests/unit/tools/jira.test.js` — update the icon/status test and add edge cases.
- No API, dependency, or config changes.

## Non-goals

- No changes to the core create/list flow (`url` + `title`).
- No changes to other `jira` actions, config, or the integration test.
