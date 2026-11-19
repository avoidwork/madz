# Proposal

## Why

The `jira` tool's `create` action only sends `project`, `summary`, `issuetype`, `description`, and `assignee` into the request body. When a user needs to set components, labels, priority, or link a new issue to an epic, the tool silently drops those values, forcing a subagent to fall back to raw `curl` — which bypasses the tool's auth, rate limiting, and error mapping. This change closes that gap so the tool can create fully-populated issues natively.

## What Changes

- Add first-class typed inputs to the `create` action for `components`, `labels`, and `priority`.
- Add a generic `fields` record to the `create` action so the model can set any Jira field, including the epic link via its custom-field ID (discovered through the existing `fields` action).
- Merge typed inputs and the generic `fields` record into the create request body, with typed inputs taking precedence on collision.
- Update the tool description so the model knows these inputs exist.
- Add unit and integration test coverage for the new inputs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-tool`: the `create` action gains the ability to set components, labels, priority, and arbitrary fields (including the epic link) at issue creation time.

## Impact

- `src/tools/jira/index.js` — extend `JiraInputSchema` and the `create` branch of `buildRequest`.
- `tests/unit/tools/jira.test.js` — new validation and body-building cases.
- `tests/integration/tools/jira.test.js` — extend the in-memory mock and lifecycle test to cover the new fields.
- No config or schema changes; no new dependencies.

## Non-goals

- No new `jira` config keys (the epic link is set via a generic field, not a named config option).
- No changes to `update`, `transition`, or other actions beyond what the generic `fields` record already supports.
- No support for Jira Cloud's different field shapes (this targets Data Center REST API v2).
