# Proposal

## Why

The `jira` tool's `remoteLinks` action types the `icon` and `status` fields of the
`link` sub-object as plain strings, but the Jira Data Center REST API v2 remote-link
schema defines both as objects (`icon: { url16x16, title, link }` and
`status: { resolved, icon, ... }`). The tool therefore sends a payload that does not
match the documented API, so remote links with icon/status metadata are rejected or
misinterpreted by Jira.

## What Changes

- Change `icon` in the `link` sub-object of `JiraInputSchema` from `z.string()` to an
  object schema with optional string fields `url16x16`, `title`, and `link`.
- Change `status` in the `link` sub-object from `z.string()` to an object schema with
  optional `resolved` (boolean), `icon` (object), and other documented fields.
- Confirm `buildRequest`'s `remoteLinks` case passes the `icon`/`status` objects
  through unchanged into the POST body `{ object }`.
- Update the tool `description` to reflect the object shapes.
- Extend unit and integration tests to cover the object shapes and edge cases
  (fields omitted, partial objects).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-tool`: The "JIRA remote link creation" requirement changes so that the
  optional `icon` and `status` fields are sent as objects matching the Jira Data
  Center REST API v2 remote-link schema, rather than as plain strings.

## Impact

- `src/tools/jira/index.js` — `JiraInputSchema` `link` sub-object and the
  `buildRequest` `remoteLinks` case; tool `description`.
- `tests/unit/tools/jira.test.js` — new/updated unit tests for the object shapes.
- `tests/integration/tools/jira.test.js` — updated integration coverage.

## Non-goals

- No change to the core create/list remote-link flow (url + title).
- No change to any other Jira action.
- No unrelated refactoring.
