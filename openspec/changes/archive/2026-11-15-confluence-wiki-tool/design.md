# Design

## Context

See proposal.md for motivation. The harness has no native wiki integration. The new `confluence` tool follows the established tool convention in `src/tools/git/index.js` and `src/tools/jira/index.js`: the export is the tool name itself (`export const confluence = tool(...)`), with `confluenceImpl` as the implementation. Transport reuses `makeApiRequest` from `src/tools/api/index.js`, which already provides URL allowlist validation, DNS-aware SSRF checks, per-host rate limiting, timeouts, redirect re-validation, and retries.

## Goals / Non-Goals

**Goals:**
- Manage Confluence Cloud wiki pages via REST API v2: search, get, create, update, delete, and metadata lookups (spaces, pages, labels, attachments).
- Reuse `makeApiRequest` for transport (DRY) — no new HTTP client, no new npm dependency.
- Resolve credentials server-side from `process.env` (`CONFLUENCE_EMAIL`, `CONFLUENCE_TOKEN`) via a named credential profile, mirroring the `jira` tool.
- Validate all input via a Zod schema; map non-2xx responses to structured errors.
- Register the tool in `src/tools/index.js` with correct permissions and classifications.

**Non-Goals:**
- Confluence Server / Data Center (REST API v1).
- Shelling out via `process`.
- A dedicated HTTP client (duplicates `makeApiRequest`).
- Storing the Confluence token in config — env vars only.

## Decisions

### Decision 1: Tool export convention
Follow the `git`/`jira` convention exactly: `export const confluence = tool((input, options = {}) => confluenceImpl(input, options), { name: "confluence", description, schema })`. Do **not** use a `createConfluenceTool()` factory unless runtime config injection is required. Because the `confluence` config section (allowlist, rateLimit, timeout, credentials) must be threaded as runtime policy, a `case "confluence"` in `buildToolConfig()` injects `config?.confluence` into the tool's runtime options — mirroring the `jira` case.

### Decision 2: Action-based dispatch
A Zod schema with an `action` enum: `search, get, create, update, delete, spaces, pages, labels, attachments`. `confluenceImpl` validates the action against the enum, validates the action-specific input, resolves the credential profile, and dispatches to a per-action handler that builds the Confluence Cloud REST API v2 request and calls `makeApiRequest`.

### Decision 3: Transport reuse
Reuse `makeApiRequest(url, { method, headers, query, body, auth, allowlist, rateLimit, timeout, ... })` from `src/tools/api/index.js`. It provides allowlist validation, DNS-aware SSRF checks, per-host rate limiting, timeouts, redirect re-validation, and retries. No new npm dependency — global `fetch` on Node 26+.

### Decision 4: Credential profile
Mirror the `jira` tool's `resolveJiraCredential`/`JiraCredentialSchema` pattern. A `confluence` config section names the env vars `CONFLUENCE_EMAIL` and `CONFLUENCE_TOKEN` (Basic auth `email:token`); the secret is resolved at call time and never appears in tool input or output. The `Authorization` header is redacted from logs.

### Decision 5: Config schema
Add `src/config/schemas/confluence.js` with `ConfluenceSchema` (baseUrl, credentials, allowlist, rateLimit, timeout) using the `JiraCredentialSchema` pattern, with empty safe defaults. Register `confluence: ConfluenceSchema.default({})` in `ConfigSchema` and export `ConfluenceSchema` from `schemas/index.js`. **No `DROPPED_KEYS` change** — the `confluence` section name is the env prefix (`CONFLUENCE_*`), unlike `sql`/`nosql`, so env vars materialize without dropping the container key.

### Decision 6: Registry wiring
Add `confluence` to `src/tools/index.js`:
- Import from `./confluence/index.js`
- `TOOL_PERMISSIONS`: `confluence: ["network:outbound"]`
- `TOOL_CLASSIFICATIONS`: `confluence: ["search", "research", "coding", "documentation", "debug"]` (mirrors `api`/`jira`)
- `TOOLS` map
- `case "confluence"` in `buildToolConfig()` injecting `config?.confluence` as runtime policy

No new `runtimeOptions` key is added, so `CONSUMED_RUNTIME_OPTION_KEYS` is unchanged and the `tool_index` guard test passes.

## Risks / Trade-offs

- [SSRF / allowlist bypass] → Reuse `makeApiRequest`'s allowlist + DNS-aware SSRF checks; validate the Confluence host per AGENTS.md §1.2.
- [Credential leakage] → Credentials in `process.env` only; resolved server-side; `Authorization` header redacted from logs.
- [Non-2xx responses] → Map 400/401/404/429 to structured `{ ok: false, error, status }`; `makeApiRequest` retries 429/502/503/504 within the retry budget.
- [Large result sets] → Pagination via `limit`/`start`; expose pagination metadata so the caller pages.
- [Missing required fields on create] → Zod validation rejects incomplete input before the request is sent.
