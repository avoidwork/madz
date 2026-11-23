# Design

## Context

See proposal.md - Why. The `jira` tool is a single-file tool in `src/tools/jira/index.js`. Actions are declared in the `JIRA_ACTIONS` array, required inputs in `REQUIRED_FIELDS`, request construction in `buildRequest()`, and input validation in the `.strict()` `JiraInputSchema`. Transport reuses `makeApiRequest`; auth is already Bearer.

## Goals / Non-Goals

- **Goals:** Add a `remoteLinks` action that lists and creates remote links for an issue, with strict input validation and full unit/integration coverage.
- **Non-Goals:** Issue links, attachments, and watchers (separate follow-ups). No new npm packages. No changes to `src/tools/index.js` (the tool is already registered).

## Decisions

### Single `remoteLinks` action with a `link` sub-object to select create vs. list
The action name is `remoteLinks` (matching the endpoint's plural resource). The create operation is selected by supplying a `link` sub-object; omitting it selects the list operation.

- **Alternative considered:** Separate `remoteLink` (create) and `remoteLinks` (list) actions. Rejected — two actions for one endpoint adds surface area without benefit, and the issue's audit suggested a single action. The `link` sub-object keeps the schema strict and unambiguous: its presence selects POST, its absence selects GET.

### `link` sub-object schema
`link` is an optional object with `url` (string, required), `title` (string, required), and optional `icon` and `status` (strings). Because `JiraInputSchema` is `.strict()`, any new input field must be declared or it is rejected. The sub-object is validated by Zod so a `link` missing `url` or `title` is rejected before any request is sent.

### Request construction
In `buildRequest()`, add a `case "remoteLinks"`:
- If `input.link` is present → `POST /issue/<key>/remotelink` with body `{ object: { url, title, icon?, status? } }`.
- Otherwise → `GET /issue/<key>/remotelink`.

The `key` is URL-encoded via `encodeURIComponent`, consistent with the existing `get`/`update`/`delete` cases.

### Transport and auth
Reuse `makeApiRequest` (per-host rate limiting, retries). Auth remains the personal access token sent as `Authorization: Bearer <token>` (already implemented at lines 267-268); no basic-auth path exists, which avoids the 401 AUTHENTICATED_FAILED HTML-page gotcha by construction.

## Risks / Trade-offs

- [`.strict()` rejects unknown fields] → Declare the `link` sub-object in `JiraInputSchema`; add unit tests for schema rejection.
- [`JIRA_ACTIONS` enum drives the `action` field] → Add `remoteLinks` to the array; a missing entry causes schema rejection.
- [Empty `object.url` / missing `object.title`] → Zod requires both; add unit tests.
- [404 for a nonexistent issue key] → Surfaced via existing `jiraErrorMessage`; add a unit test.

## Migration Plan

No migration. The new action is additive; existing actions are unchanged.

## Open Questions

None.
