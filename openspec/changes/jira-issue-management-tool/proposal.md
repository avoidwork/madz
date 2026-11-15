# Proposal

## Why

The harness has a `git` tool for source control but no native issue-tracker integration. For software-architecture and distributed-systems workflows, JIRA is a genuine blind spot. The only current path is the generic `api` tool (which requires hand-building JQL and endpoint URLs plus manual credential handling) or `process` plus a CLI client, which is fragile and bypasses sandbox validation. A dedicated `jira` tool gives the agent a typed, validated surface for the operations it performs most: searching by JQL, reading issue details, and mutating workflow state.

## What Changes

- Add a new `jira` tool (`src/tools/jira/index.js`) targeting JIRA Cloud REST API v3, with a Zod schema and action-based dispatch mirroring the `git` tool's `action` enum. Actions: `search, get, create, update, delete, transition, comment, assign, projects, issueTypes, statuses, fields, users`.
- Reuse `makeApiRequest` from `src/tools/api/index.js` for transport (DRY): URL allowlist validation, DNS-aware SSRF checks, per-host rate limiting, timeouts, redirect re-validation, and retries. No new npm dependency — global `fetch` on Node 26+.
- Auth via a server-side credential profile resolved from `process.env` only (`JIRA_EMAIL`, `JIRA_TOKEN`, Basic auth `email:token`), mirroring the `api` tool's `resolveCredential`/`ApiCredentialSchema` pattern. Secrets never appear in tool input or output.
- Register the tool in `src/tools/index.js` (import, `TOOLS` map, `TOOL_PERMISSIONS` = `network:outbound`, `TOOL_CLASSIFICATIONS`, and a `case "jira"` in `buildToolConfig()` that injects the `jira` config section as runtime policy).
- Add the `jira` config schema (`src/config/schemas/jira.js`) with empty safe defaults, register `jira: JiraSchema.default({})` in `ConfigSchema`, and export `JiraSchema` from `schemas/index.js`. No `DROPPED_KEYS` change — the `jira` section name is the env prefix (`JIRA_*`), unlike `sql`/`nosql`.
- Add unit tests (`tests/unit/tools/jira.test.js`) and an integration test (`tests/integration/tools/jira.test.js`) against a mocked JIRA server.

## Capabilities

### New Capabilities
- `jira-tool`: Managing JIRA Cloud issues (search, get, create, update, delete, transition, comment, assign, and metadata lookups) via the REST API v3, with server-side credential profiles and sandbox allowlist enforcement on the JIRA host.

### Modified Capabilities
<!-- No existing capability changes. -->

## Impact

- **Code**: `src/tools/jira/index.js` (new), `src/tools/index.js` (registry wiring), `src/config/schemas/jira.js` (new), `src/config/schemas/index.js` (export), `src/config/config.js` (ConfigSchema registration).
- **Tests**: `tests/unit/tools/jira.test.js`, `tests/integration/tools/jira.test.js` (new).
- **Dependencies**: None (runtime) — reuses `makeApiRequest` and global `fetch`.
- **Security**: URL allowlist + SSRF protection via `makeApiRequest` (A03 Injection / SSRF), credentials in `process.env` only (A07), no secrets in logs (redact Authorization header).

## Non-goals

- JIRA Server / Data Center (REST API v2) — out of scope for the initial implementation.
- Shelling out via `process`.
- A dedicated HTTP client — duplicates `makeApiRequest`'s allowlist/rate-limit/retry logic (DRY).
- Storing the JIRA token in config — env vars only.
