## Context

Madz currently provides tools for web search, content extraction, and file operations, but lacks structured API interaction capabilities. The agent must fall back to shell commands (curl, jq, yq) for REST API calls, GraphQL queries, and data manipulation. This creates inconsistency, error-proneness, and prevents reliable programmatic API interaction.

The existing tool pattern in `src/tools/` provides a proven template: Zod schema validation, async implementation function, and registration in `src/tools/index.js` with permission tiers. All new tools must follow this pattern.

## Goals / Non-Goals

**Goals:**
- Provide authenticated REST API client with all HTTP methods
- Provide GraphQL client with query, mutation, and introspection support
- Provide webhook management with HMAC-SHA256 verification
- Provide JSON/YAML manipulation with path-based access
- Provide cross-format data transformation (JSON ↔ YAML ↔ CSV)
- Follow existing tool pattern and security constraints from AGENTS.md

**Non-Goals:**
- Embedded HTTP server for receiving webhooks
- OAuth 2.0 flow implementation
- Webhook delivery retry logic
- Streaming/SSE support for API responses
- Connection pooling or request batching

## Decisions

### Decision 1: Split into separate tools (api, webhook, json, yaml, data-transform)

**Rationale:** Each tool has distinct functionality and permission requirements. Grouping them would create bloated tools with unclear boundaries. The existing pattern favors focused tools.

**Alternatives considered:**
- Single monolithic `api` tool — rejected: too many responsibilities, harder to test and maintain.
- Two tools (api + data) — rejected: webhook management is distinct enough to warrant its own tool.

### Decision 2: Use node-fetch (v3.x) over axios

**Rationale:** node-fetch v3.x uses the native Fetch API, providing zero additional dependencies. axios adds ~200KB and introduces a different API paradigm. The project already uses native fetch for other operations.

**Alternatives considered:**
- axios — rejected: larger dependency footprint, different API paradigm.
- Native `fetch` only — rejected: node-fetch provides better error handling and compatibility.

### Decision 3: Use graphql-request over @apollo/client

**Rationale:** graphql-request is lightweight (~50KB), supports queries, mutations, and introspection without React dependency. @apollo/client is React-focused and adds significant bundle size.

**Alternatives considered:**
- @apollo/client — rejected: React dependency, heavy bundle, overkill for CLI tool.
- Manual GraphQL over fetch — rejected: graphql-request handles serialization, error handling, and introspection cleanly.

### Decision 4: Use jsonpath-plus for JSON path access

**Rationale:** jsonpath-plus is well-maintained, supports complex JSONPath expressions, and works with ESM. It provides both read and write operations.

**Alternatives considered:**
- jsonpath — rejected: older, less maintained, CommonJS-only.
- Manual path traversal — rejected: reinvents wheel, error-prone for nested structures.

### Decision 5: Use js-yaml for YAML handling

**Rationale:** js-yaml is well-maintained, supports YAML 1.2, provides load/dump with schema validation, and works with ESM.

**Alternatives considered:**
- yaml (syllab) — rejected: js-yaml is more widely used in the Node.js ecosystem, better documented.
- Manual YAML parsing — rejected: YAML is complex (anchors, references, multi-doc), manual parsing is error-prone.

### Decision 6: Use csv-parse and csv-generate from same author

**Rationale:** csv-parse, csv-generate, and csv-stringify are from the same author (Gregory), providing consistent API and reliable CSV handling. csv-parse handles parsing, csv-generate handles generation.

**Alternatives considered:**
- papaparse — rejected: browser-focused, larger bundle.
- manual CSV handling — rejected: CSV edge cases (quoted fields, escaping, delimiters) are error-prone.

## Risks / Trade-offs

### Risk: URL allowlist enforcement complexity
→ **Mitigation:** Reuse existing URL validation patterns from the sandbox module. Implement allowlist as a configurable list in config.yaml with strict default (empty = deny all).

### Risk: Large response bodies causing memory issues
→ **Mitigation:** Implement response size limit (default 10MB). Stream large responses where possible. Return error for oversized responses.

### Risk: GraphQL query depth/complexity DoS
→ **Mitigation:** Enforce depth limit (default: 10) and complexity limit (default: 1000). Log violations. Make limits configurable.

### Risk: Webhook HMAC verification timing attacks
→ **Mitigation:** Use `crypto.timingSafeEqual` for signature comparison. Reject expired signatures (configurable window, default: 5 minutes).

### Risk: Dependency bloat
→ **Mitigation:** 6 new dependencies total (~500KB combined). Acceptable for the functionality gained. Document dependencies in CHANGELOG.

## Migration Plan

1. Add dependencies to package.json
2. Create tool files in src/tools/
3. Register tools in src/tools/index.js
4. Update AGENTS.md with new tool documentation
5. Add unit tests for each tool
6. Run full test suite, lint, and coverage checks

## Open Questions

- Should the REST API client support request/response caching with TTL? (deferred to future iteration)
- Should webhook management include a local test endpoint for development? (deferred — out of scope)
- Should data transformation support custom mapping functions (not just field renaming)? (deferred — out of scope)
