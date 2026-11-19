# Design

## Context

The `confluence` tool hardcodes the Confluence Cloud REST API v2 base path (`API_V2 = "/wiki/api/v2"`), but the deployment is Confluence Data Center 10.2.20, which serves REST v1 at `/rest/api/...` and does not expose the `/wiki` prefix. Every request lands on an unrecognized path, 302-redirects to the login page, and — because the redirect is same-origin — the bearer token survives, the login page returns `200 text/html`, and the tool reports success with a worthless body. See proposal.md - Why and the post-mortem gist.

## Goals / Non-Goals

**Goals:**

- Support both Confluence Cloud REST v2 and Data Center REST v1 via a configurable `confluence.api` mode (`cloud` | `dc`), defaulting to `cloud`.
- Convert the silent wrong answer (HTML login page returned as success) into a loud error.
- Fix the `search` action to use the correct search endpoint for each mode.
- Preserve existing Cloud behavior by default.

**Non-Goals:**

- No change to the `confluence-wiki` skill.
- No support for Confluence Server beyond what DC v1 covers.
- No changes to the generic `api` tool's redirect handling.

## Decisions

### Configurable API mode

Add `confluence.api` (`cloud` | `dc`, default `cloud`) to `ConfluenceSchema`. `buildRequest` takes the mode and selects the base path (`/wiki/api/v2` for cloud, `/rest/api` for dc) and the request/response shapes.

**Rationale:** The gist's minimal fix (make the path configurable) alone would not make the tool work against DC, because the request and response shapes differ substantially (DC uses `/rest/api/content/{id}?expand=body.storage`, `{ type, space: { key }, ancestors }` bodies, `/rest/api/search`, `/rest/api/space`, `/rest/api/content/{id}/label`, `/rest/api/content/{id}/child/attachment`). A mode switch handles both cleanly.

**Alternatives considered:** Pivot entirely to DC v1 (breaks Cloud users); minimal path-only fix (doesn't actually work against DC).

### Reject non-JSON responses

After a successful response, if `content-type` is present and not `application/json`, return `ok: false` with a diagnostic. An absent content-type is treated as ambiguous, not a failure.

**Rationale:** This converts the silent wrong answer into a loud one. The `makeApiRequest` result preserves `content-type` in `result.headers`.

### Detect login redirects

Check the final response URL and body for `/login.action` or `permissionViolation` and fail fast with an authentication/endpoint diagnostic. This is checked before the non-JSON rejection so the more specific diagnostic wins.

**Rationale:** The transport follows same-origin redirects and preserves the bearer token, so the login page returns 200. Detecting the redirect target gives a clearer message than a generic non-JSON error.

### Fix the search endpoint

Cloud CQL search lives at `/wiki/rest/api/search` (not under the v2 base path); DC search lives at `/rest/api/search`. The `search` action now targets the correct endpoint per mode.

**Rationale:** The old `/pages?cql=` endpoint does not accept CQL and would fail even on Cloud.

## Risks / Trade-offs

- [DC v1 response shapes may vary slightly across versions] → The tool targets the documented v1 shapes; the `confluence-wiki` skill already works against this deployment and validates responses.
- [The non-JSON rejection could reject a valid non-JSON response] → Confluence's REST API returns JSON; an absent content-type is not rejected, only an explicitly non-JSON one.
- [The `spaceId`/`spaceKey` split adds schema surface] → Both are accepted; the mode determines which is used, and the schema requires at least one for `create`.

## Migration Plan

No migration. `confluence.api` defaults to `cloud`, so existing Cloud configurations are unaffected. DC users set `confluence.api: dc`.

## Open Questions

None.
