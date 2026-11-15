# Proposal

## Why

The harness has a `git` tool for source control and (with issue #1822) a `jira` tool for issue tracking, but no wiki integration. For software-architecture and distributed-systems workflows, Confluence is where design docs, ADRs, and runbooks live — a genuine blind spot. The only current path is the generic `api` tool (which requires hand-building Confluence endpoints plus manual credential handling) or `process` plus a CLI client, which is fragile and bypasses sandbox validation. A dedicated `confluence` tool gives the agent a typed, validated surface for the operations it performs most: searching for content, reading page bodies, and publishing/updating documentation.

## What Changes

- Add a new `confluence` tool (`src/tools/confluence/index.js`) targeting Confluence Cloud REST API v2 (`https://<site>.atlassian.net/wiki/api/v2`), with a Zod schema and action-based dispatch mirroring the `git` tool's `action` enum. Actions: `search, get, create, update, delete, spaces, pages, labels, attachments`.
- Reuse `makeApiRequest` from `src/tools/api/index.js` for transport (DRY): URL allowlist validation, DNS-aware SSRF checks, per-host rate limiting, timeouts, redirect re-validation, and retries. No new npm dependency — global `fetch` on Node 26+.
- Auth via a server-side credential profile resolved from `process.env` only (`CONFLUENCE_EMAIL`, `CONFLUENCE_TOKEN`, Basic auth `email:token`), mirroring the `jira` tool's credential pattern. Secrets never appear in tool input or output.
- Register the tool in `src/tools/index.js` (import, `TOOLS` map, `TOOL_PERMISSIONS` = `network:outbound`, `TOOL_CLASSIFICATIONS`, and a `case "confluence"` in `buildToolConfig()` that injects the `confluence` config section as runtime policy).
- Add the `confluence` config schema (`src/config/schemas/confluence.js`) with empty safe defaults, register `confluence: ConfluenceSchema.default({})` in `ConfigSchema`, and export `ConfluenceSchema` from `schemas/index.js`. No `DROPPED_KEYS` change — the `confluence` section name is the env prefix (`CONFLUENCE_*`), unlike `sql`/`nosql`.
- Add unit tests (`tests/unit/tools/confluence.test.js`) and an integration test (`tests/integration/tools/confluence.test.js`) against a mocked Confluence server.

## Capabilities

### New Capabilities
- `confluence-tool`: Managing Confluence Cloud wiki pages (search, get, create, update, delete, and metadata lookups for spaces, pages, labels, attachments) via the REST API v2, with server-side credential profiles and sandbox allowlist enforcement on the Confluence host.

### Modified Capabilities
<!-- No existing capability changes. -->

## Impact

- **Code**: `src/tools/confluence/index.js` (new), `src/tools/index.js` (registry wiring), `src/config/schemas/confluence.js` (new), `src/config/schemas/index.js` (export), `src/config/config.js` (ConfigSchema registration).
- **Tests**: `tests/unit/tools/confluence.test.js`, `tests/integration/tools/confluence.test.js` (new).
- **Dependencies**: None (runtime) — reuses `makeApiRequest` and global `fetch`.
- **Security**: URL allowlist + SSRF protection via `makeApiRequest` (A03 Injection / SSRF), credentials in `process.env` only (A07), no secrets in logs (redact Authorization header).

## Non-goals

- Confluence Server / Data Center (REST API v1) — out of scope for the initial implementation.
- Shelling out via `process`.
- A dedicated HTTP client — duplicates `makeApiRequest`'s allowlist/rate-limit/retry logic (DRY).
- Storing the Confluence token in config — env vars only.
