## Context

The madz harness uses a tool-based architecture where each tool is a plain async function with a Zod input schema, registered in `src/tools/index.js`. Action-based tools (like `email` and `process`) use a single tool with an `action` enum parameter that dispatches to handler functions. The name.com API is a RESTful API with 72 operations across 17 tag groups, using Basic Auth with username:token, rate-limited to 20 requests/second.

## Goals / Non-Goals

**Goals:**
- Single `namecom` tool wrapping all 72 name.com Core API operations
- Action-based dispatch pattern matching existing tools
- Basic Auth via `NAMECOM_USERNAME` and `NAMECOM_TOKEN` env vars
- URL allowlist validation for outbound requests
- Consistent error handling for API errors (401, 403, 429, 500, 502, 503, 504)
- Full test coverage across all 17 tag groups

**Non-Goals:**
- OAuth authentication flows
- Caching layer for API responses
- Request queue/bulk operation throttling (rate limit is 20 req/s, generous for most use cases)
- Domain parking or transfer-out flows not covered by the API spec

## Decisions

### Decision 1: Single tool with action enum vs. separate tools per tag group
**Choice:** Single tool with `action` parameter.
**Rationale:** 17+ separate tools would bloat the tool surface. The `email` and `process` tools demonstrate this pattern works well. The LLM can reason about a single tool with 40+ actions more effectively than 17 separate tools.
**Alternatives considered:** Separate tools per tag group (rejected — too many tools, fragmented tool surface).

### Decision 2: Zod schema design — flat optional fields vs. params record
**Choice:** Common parameters as optional fields (`domainName`, `perPage`, `page`, `type`, `name`, `value`, `ttl`), action-specific parameters via a flexible `params` record.
**Rationale:** The API has 72 operations with varying parameters. A flat schema with 100+ optional fields is unwieldy. A `params` record keeps the schema manageable while still providing type safety for common parameters.
**Alternatives considered:** Flat schema with all parameters as optional fields (rejected — too large, hard to maintain).

### Decision 3: Native fetch vs. HTTP library
**Choice:** Native `fetch()` (Node.js 24+).
**Rationale:** No external dependencies needed. The API is simple REST — no need for axios or node-fetch. Basic Auth is trivial with `fetch` headers.
**Alternatives considered:** axios (rejected — adds dependency for no benefit).

### Decision 4: URL allowlist enforcement
**Choice:** Hardcoded allowlist of `api.name.com` and `api.dev.name.com` in the HTTP client.
**Rationale:** OWASP compliance — prevents SSRF via user-controlled URLs. The API base URL is fixed, so a hardcoded allowlist is appropriate.
**Alternatives considered:** Configurable base URL (rejected — unnecessary flexibility, security risk).

## Risks / Trade-offs

- **Rate limiting:** 20 req/s limit means bulk operations need throttling. Mitigation: Document the limit in the tool description, return guidance on 429 responses. Full queue implementation deferred.
- **Large Zod schema:** 40+ actions with varying parameters. Mitigation: `params` record for action-specific fields, common parameters as optional fields.
- **Error handling:** API returns varying response shapes for different error codes. Mitigation: Consistent error wrapper in `makeRequest()` that normalizes all errors to `{ ok: false, error: string }`.

## Migration Plan

No migration needed — this is a greenfield feature. The tool is registered alongside existing tools and requires no config.yaml changes.

## Open Questions

- None. The action map, auth design, and schema approach are defined by the issue specification.