# Proposal

## Why

The `confluence` tool is written against Confluence Cloud REST API v2 (`/wiki/api/v2/...`), but the deployment it is pointed at is Confluence Data Center 10.2.20, which serves REST v1 at `/rest/api/...` and does not expose the `/wiki` prefix at all. Every request lands on an unrecognized path, 302-redirects to the login page, and — because the redirect is same-origin — the bearer token survives, the login page returns `200 text/html`, and the tool reports success with a worthless body. This is a silent wrong answer: `ok: true` with no content. The `search` action is also broken even for Cloud (it hits `/pages?cql=` instead of the real search endpoint). See the post-mortem gist for the full evidence.

## What Changes

- Add a configurable `confluence.api` mode (`cloud` | `dc`) that switches both the API path prefix and the request/response shapes, so the tool works against both Confluence Cloud v2 and Data Center v1. Default to `cloud`, preserving existing behavior.
- Reject non-JSON (HTML) responses on JSON API calls so a silent wrong answer becomes a loud error.
- Detect login-redirect responses (`/login.action`, `permissionViolation`) and fail fast with a diagnostic instead of following them.
- Fix the `search` action to use the correct search endpoint for each mode.
- Update the tool description to document the Cloud/DC split and the new config key.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `confluence-tool`: the tool gains Data Center v1 support via a configurable API mode, rejects HTML responses, detects login redirects, and fixes the search endpoint.

## Impact

- `src/tools/confluence/index.js` — mode-aware request building, response validation.
- `src/config/schemas/confluence.js` — add `api` mode config key.
- `config.yaml` — document the new `confluence.api` key.
- `tests/unit/tools/confluence.test.js` and `tests/integration/tools/confluence.test.js` — new mode, HTML-rejection, and login-redirect cases.
- No new dependencies.

## Non-goals

- No change to the `confluence-wiki` skill (it already targets DC correctly).
- No support for Confluence Server (the older on-prem variant) beyond what DC v1 covers.
- No changes to the generic `api` tool's redirect handling.
