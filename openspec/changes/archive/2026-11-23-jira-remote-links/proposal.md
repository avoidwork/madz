# Proposal

## Why

The harness `jira` tool exposes search, get, create, update, delete, transitions, transition, comment, assign, projects, issueTypes, statuses, fields, and users actions, but has no action for remote links (web links). Linking a Jira ticket to a pull request — a common, high-value workflow — cannot be done through the tool and must go through the Jira REST API directly. This is a capability gap that breaks the "link this Jira ticket to that PR" flow.

## What Changes

- Add a `remoteLinks` action to the `jira` tool that wraps the JIRA Data Center REST API v2 remote-link endpoint `/rest/api/2/issue/<KEY>/remotelink`.
- **Read (list):** `GET /rest/api/2/issue/<KEY>/remotelink` returns existing remote links for an issue.
- **Create:** `POST /rest/api/2/issue/<KEY>/remotelink` with a JSON payload `{ object: { url, title, icon?, status? } }` creates a remote link and returns 201 with `{ id, self }`.
- The action requires a `key`; the create operation is selected by supplying a `link` sub-object (`url` and `title` required, `icon` and `status` optional), while omitting it selects the read/list operation.
- Transport reuses the existing `makeApiRequest` (per-host rate limiting, retries). Auth remains the personal access token sent as `Authorization: Bearer <token>`.
- Update the `jira` tool `description` string to advertise the new action.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-tool`: Add a requirement for the `remoteLinks` action that reads and creates remote links for an issue via the `/rest/api/2/issue/<KEY>/remotelink` endpoint, validating the `key` and the `link` payload (`url`, `title` required; `icon`, `status` optional) before sending.

## Impact

- `src/tools/jira/index.js` — `JIRA_ACTIONS`, `REQUIRED_FIELDS`, `buildRequest()`, `JiraInputSchema`, and the `description` string.
- `tests/unit/tools/jira.test.js` — new unit cases for read, create, missing-key, and schema rejection.
- `tests/integration/tools/jira.test.js` — new mock route and a create-then-read round-trip case.
- No new npm packages. No changes to `src/tools/index.js` (the tool is already registered).

## Non-goals

- Issue links (`/rest/api/2/issueLink`), attachments (`/rest/api/2/issue/<KEY>/attachments`), and watchers (`/rest/api/2/issue/<KEY>/watchers`) are explicitly out of scope for this change and tracked as separate follow-up issues per the issue's Split Recommendation.
