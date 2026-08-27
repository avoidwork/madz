## Context

The madz AI harness has web search and content extraction tools but lacks structured API interaction capabilities. Users need to call REST APIs, query GraphQL endpoints, manage webhooks, and manipulate structured data without falling back to shell commands.

## Goals / Non-Goals

**Goals:**
- REST API client with authentication and security validation
- GraphQL client with query/mutation support and safety limits
- Webhook management with HMAC verification
- JSON, YAML, and CSV manipulation tools
- Format conversion between data formats

**Non-Goals:**
- OAuth 2.0 authentication
- WebSocket subscriptions
- Webhook delivery retries
- Response caching
- Webhook dashboard/UI

## Decisions

### Decision 1: Split into three tool groups (api, webhooks, data)
**Rationale:** Keeps each tool focused and maintainable. A monolithic "api" tool would violate single responsibility. The existing tool pattern supports multiple files under a common registration.

### Decision 2: Use node-fetch (v3.x) for REST API
**Rationale:** Zero dependencies, uses native fetch API (Node.js 24+), aligns with modern JavaScript. Axios adds unnecessary dependencies.

### Decision 3: Use graphql-request (v6.x) for GraphQL
**Rationale:** Lightweight, supports queries/mutations/introspection. @apollo/client is React-focused and too heavy.

### Decision 4: Use Node.js built-in http module for webhooks
**Rationale:** Webhook management is straightforward (route registration, HMAC verification). fastify adds a dependency that isn't justified for this scope.

### Decision 5: Reuse js-yaml (already a dependency)
**Rationale:** YAML manipulation doesn't need a new dependency. js-yaml is well-maintained and already used in the project.

### Decision 6: Add jsonpath-plus for JSONPath support
**Rationale:** Full JSONPath expression support is more powerful than custom path resolution. Well-maintained with good test coverage.

## Risks / Trade-offs

[Risk: Large response bodies causing memory exhaustion] → Mitigation: 10MB response body size limit
[Risk: DNS rebinding attacks on internal IP blocking] → Mitigation: Validate both hostname and resolved IP
[Risk: GraphQL query complexity attacks] → Mitigation: Depth limit (10) and complexity limit (1000)
[Risk: Webhook delivery failures] → Mitigation: Structured error responses, logging for debugging
[Risk: Multiple new dependencies] → Mitigation: Each dependency serves a clear purpose, all are well-maintained

## Migration Plan

No migration needed — this is a new feature. Tools are registered alongside existing tools in src/tools/index.js.

## Open Questions

- Should the REST API client support connection pooling?
- Should webhook configurations be persisted to disk?
- Should the GraphQL client support subscriptions?