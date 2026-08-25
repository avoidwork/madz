## Context

The madz project currently provides tools for web search, content extraction, file operations, and email. There is no structured API interaction capability — the agent must fall back to shell commands (curl, jq, yq) or rely on ad-hoc LLM reasoning for REST API calls, GraphQL queries, JSON/YAML manipulation, and webhook management. This is inconsistent and error-prone for office and marketing workflows.

The project uses a tool factory pattern: each tool is a plain async function with a Zod input schema, registered in `src/tools/index.js` with permission tiers. Tools live in `src/tools/` and tests mirror the structure in `tests/unit/`.

## Goals / Non-Goals

**Goals:**
- Provide structured, validated tools for REST API, GraphQL, JSON, YAML, data transformation, and webhook management
- Enforce URL allowlist security per AGENTS.md §1.2 on all network tools
- Follow existing tool pattern: Zod schema → impl function → registration
- Include comprehensive unit and integration tests

**Non-Goals:**
- Subscription support for GraphQL (deferred)
- Embedded webhook server (agent-facing tool only)
- File I/O for JSON/YAML/CSV tools (in-memory operations only)
- OAuth/OIDC authentication flows (Bearer, Basic, API Key only)
- Response caching (considered but deferred)

## Decisions

1. **Single tool per capability**: Each capability (REST, GraphQL, JSON, YAML, data, webhook) gets its own file in `src/tools/`. This follows the existing pattern and keeps tools focused.

2. **Native `fetch` API**: Use Node.js 24+ built-in `fetch` for REST requests rather than adding axios or node-fetch. Zero additional dependencies, modern API, consistent with the runtime.

3. **graphql-request for GraphQL**: Lightweight library (v6.x) that supports queries, mutations, and schema introspection. Avoids the heavier @apollo/client which is React-focused.

4. **jsonpath-plus for JSONPath**: Well-maintained v8.x library supporting JSONPath expressions for path-based JSON access.

5. **js-yaml for YAML**: Established v4.x library with load/dump and schema validation.

6. **csv-parse/csv-generate for CSV**: Same author as csv-stringify, reliable and well-maintained v6.x.

7. **HMAC-SHA256 for webhook verification**: Industry standard, supported natively by Node.js `crypto` module.

8. **URL allowlist enforcement**: All network tools validate URLs against an allowlist before making requests. Disallow file://, gopher://, dict:// schemes. Reject internal IPs unless explicitly allowed.

## Risks / Trade-offs

- **Risk**: Adding 5 new npm dependencies increases bundle size.
  → **Mitigation**: All dependencies are lightweight, well-maintained, and commonly used. graphql-request is ~50KB, jsonpath-plus ~30KB, js-yaml ~100KB.

- **Risk**: Webhook HMAC verification could be bypassed if secret is weak.
  → **Mitigation**: Document best practices for secret generation. Tool accepts any secret string; security is user responsibility.

- **Risk**: GraphQL query depth/complexity limits could be circumvented.
  → **Mitigation**: graphql-request supports depth limiting via custom plugins. Default limits (depth: 10, complexity: 1000) are configurable.

- **Risk**: URL allowlist configuration could be forgotten by users.
  → **Mitigation**: Tool returns clear error messages when URL is not on allowlist, with instructions on how to add it.

## Migration Plan

No migration needed — this is a net-new feature. All tools are additive to the existing tool registry.

## Open Questions

- Should webhook management include delivery status tracking? (deferred to v2)
- Should the REST client support request/response middleware for logging? (deferred)
- Should JSON/YAML tools support file I/O in addition to in-memory operations? (deferred, but could be added via a separate `filesystem:read/write` permission)
