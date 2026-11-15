# Design

## Context

See proposal.md for motivation. The harness has no native issue-tracker integration. The new `jira` tool follows the established tool convention in `src/tools/git/index.js`: the export is the tool name itself (`export const jira = tool(...)`), with `jiraImpl` as the implementation. Transport reuses `makeApiRequest` from `src/tools/api/index.js`, which already provides URL allowlist validation, DNS-aware SSRF checks, per-host rate limiting, timeouts, redirect re-validation, and retries.

## Goals / Non-Goals

**Goals:**
- Manage JIRA Cloud issues via REST API v3: search, get, create, update, delete, transition, comment, assign, and metadata lookups (projects, issueTypes, statuses, fields, users).
- Reuse `makeApiRequest` for transport (DRY) — no new HTTP client, no new npm dependency.
- Resolve credentials server-side from `process.env` (`JIRA_EMAIL`, `JIRA_TOKEN`) via a named credential profile, mirroring the `api` tool.
- Validate all input via a Zod schema; map non-2xx responses to structured errors.
- Register the tool in `src/tools/index.js` with correct permissions and classifications.

**Non-Goals:**
- JIRA Server / Data Center (REST API v2).
- Shelling out via `process`.
- A dedicated HTTP client (duplicates `makeApiRequest`).
- Storing the JIRA token in config — env vars only.

## Decisions

### Decision 1: Tool export convention
Follow the `git` convention exactly: `export const jira = tool((input, options = {}) => jiraImpl(input, options), { name: "jira", description, schema })`. Do **not** use a `createJiraTool()` factory unless runtime config injection is required. Because the `jira` config section (allowlist, rateLimit, timeout, credentials) must be threaded as runtime policy, a `case "jira"` in `buildToolConfig()` injects `config?.jira` into the tool's runtime options — mirroring the `api` case.

### Decision 2: Action-based dispatch
A Zod schema with an `action` enum: `search, get, create, update, delete, transition, comment, assign, projects, issueTypes, statuses, fields, users`. `jiraImpl` validates the action against the enum, validates the action-specific input, resolves the credential profile, and dispatches to a per-action handler that builds the JIRA Cloud REST API v3 request and calls `makeApiRequest`.

### Decision 3: Transport reuse
Reuse `makeApiRequest(url, { method, headers, query, body, auth, allowlist, rateLimit, timeout, ... })` from `src/tools/api/index.js`. It provides allowlist validation, DNS-aware SSRF checks, per-host rate limiting, timeouts, redirect re-validation, and retries. No new npm dependency — global `fetch` on Node 26+.

### Decision 4: Credential profile
Mirror the `api` tool's `resolveCredential`/`ApiCredentialSchema` pattern. A `jira` config section names the env vars `JIRA_EMAIL` and `JIRA_TOKEN` (Basic auth `email:token`); the secret is resolved at call time and never appears in tool input or output. The `Authorization` header is redacted from logs.

### Decision 5: Config schema
Add `src/config/schemas/jira.js` with `JiraSchema` (baseUrl, credentials, allowlist, rateLimit, timeout) using the `ApiCredentialSchema` pattern, with empty safe defaults. Register `jira: JiraSchema.default({})` in `ConfigSchema` and export `JiraSchema` from `schemas/index.js`. **No `DROPPED_KEYS` change** — the `jira` section name is the env prefix (`JIRA_*`), unlike `sql`/`nosql`, so env vars materialize without dropping the container key.

### Decision 6: Registry wiring
Add `jira` to `src/tools/index.js`:
- Import from `./jira/index.js`
- `TOOL_PERMISSIONS`: `jira: ["network:outbound"]`
- `TOOL_CLASSIFICATIONS`: `jira: ["search", "research", "coding", "documentation", "debug"]` (mirrors `api`)
- `TOOLS` map
- `case "jira"` in `buildToolConfig()` injecting `config?.jira` as runtime policy

If any runtime key is added to `runtimeOptions`, it must also be added to `CONSUMED_RUNTIME_OPTION_KEYS` or the `tool_index` guard test fails.

## Risks / Trade-offs

- [SSRF / allowlist bypass] → Reuse `makeApiRequest`'s allowlist + DNS-aware SSRF checks; validate the JIRA host per AGENTS.md §1.2.
- [Credential leakage] → Credentials in `process.env` only; resolved server-side; `Authorization` header redacted from logs.
- [Non-2xx responses] → Map 400/401/404/429 to structured `{ ok: false, error, status }`; `makeApiRequest` retries 429/502/503/504 within the retry budget.
- [Large result sets] → Pagination via `startAt`/`maxResults`; expose `total`/`startAt` so the caller pages.
- [Missing required fields on create] → Zod validation rejects incomplete input before the request is sent.
