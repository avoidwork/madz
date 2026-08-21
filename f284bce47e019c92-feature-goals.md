# Feature Goals: Structured Data and API Interaction Tools

## Goal 1: REST API Client Tool

### Scope
- Create a tool that makes authenticated HTTP requests (GET, POST, PUT, DELETE, PATCH)
- Support configurable headers, request body, and authentication methods (Bearer, Basic, API Key)
- Validate URLs against allowlist (no file://, gopher://, dict:// schemes)
- Reject requests to internal IPs unless explicitly allowed
- Implement configurable timeouts (default: 30s)
- Implement client-side rate limiting (default: 10 requests/second)
- Return structured error objects with HTTP status, response body, and error message

### Key Requirements
- Zod schema validation for all inputs
- URL allowlist validation per AGENTS.md 1.2
- Response body size limit (default: 10MB)
- Strip sensitive headers from proxied responses
- Never expose raw stack traces

### Acceptance Criteria
- All HTTP methods supported (GET, POST, PUT, DELETE, PATCH)
- Authentication methods work correctly (Bearer, Basic, API Key)
- URL validation blocks disallowed schemes and internal IPs
- Timeouts work as configured
- Rate limiting enforces configured limits
- Error responses are structured and informative

### Dependencies
- `node-fetch` (v3.x) for HTTP requests (native fetch API, zero dependencies)
- Existing URL allowlist validation from sandbox/urlFilter.js
- Existing permission model from src/skills/

### Risks / Edge Cases
- Large response bodies causing memory exhaustion
- DNS rebinding attacks on internal IP blocking
- Rate limit headers from upstream servers
- Connection timeouts vs. read timeouts

## Goal 2: GraphQL Client Tool

### Scope
- Execute GraphQL queries and mutations against remote endpoints
- Support schema introspection
- Limit query depth (default: 10) and complexity (default: 1000)
- Disable introspection in production unless explicitly enabled
- Support variables and operation names

### Key Requirements
- Zod schema validation for all inputs
- URL allowlist validation
- Query depth and complexity limiting
- Configurable timeouts
- Structured error handling

### Acceptance Criteria
- Queries execute successfully with valid input
- Mutations execute successfully with valid input
- Schema introspection works when enabled
- Query depth limits prevent deeply nested queries
- Complexity limits prevent expensive queries

### Dependencies
- `graphql-request` (v6.x) for GraphQL client
- Existing URL allowlist validation
- Existing permission model

### Risks / Edge Cases
- Malformed GraphQL queries
- Introspection security in production
- Query complexity attacks
- Large response payloads

## Goal 3: Webhook Management Tool

### Scope
- Create, list, and manage webhook endpoints
- Support payload validation using HMAC-SHA256
- Rate-limit webhook endpoints (default: 100 requests/minute per source IP)
- Store webhook configurations securely (process.env only)

### Key Requirements
- Zod schema validation for all inputs
- HMAC-SHA256 signature verification
- Rate limiting middleware
- Secure storage (no config files, no logs)
- Webhook event filtering

### Acceptance Criteria
- Webhooks can be created with custom URLs and secrets
- Webhook signatures are verified on incoming requests
- Rate limiting works correctly
- Webhooks can be listed and deleted
- Invalid signatures are rejected

### Dependencies
- `fastify` (v5.x) for lightweight HTTP server
- Node.js built-in `crypto` module for HMAC
- Existing permission model

### Risks / Edge Cases
- Webhook delivery failures
- Invalid or expired secrets
- Rate limit exhaustion
- Concurrent webhook deliveries

## Goal 4: JSON Manipulation Tool

### Scope
- Parse, transform, filter, and serialize JSON data
- Support path-based access using JSONPath expressions
- Use `jsonpath-plus` (v8.x) for JSONPath support
- Handle edge cases (invalid JSON, missing paths, large payloads)

### Key Requirements
- Zod schema validation for all inputs
- JSONPath expression support
- Path-based filtering and transformation
- Error handling for invalid JSON

### Acceptance Criteria
- JSON parsing works with valid input
- JSONPath queries return correct results
- JSON serialization produces valid output
- Invalid JSON input returns structured error
- Missing paths handled gracefully

### Dependencies
- `jsonpath-plus` (v8.x) for JSONPath support
- Built-in JSON.parse/stringify

### Risks / Edge Cases
- Invalid JSON input
- Malformed JSONPath expressions
- Large JSON payloads
- Circular references

## Goal 5: YAML Manipulation Tool

### Scope
- Parse, transform, filter, and serialize YAML data
- Support path-based access
- Use `js-yaml` (v4.x) for YAML handling
- Handle edge cases (invalid YAML, missing paths, large payloads)

### Key Requirements
- Zod schema validation for all inputs
- YAML parsing and serialization
- Path-based filtering and transformation
- Error handling for invalid YAML

### Acceptance Criteria
- YAML parsing works with valid input
- YAML serialization produces valid output
- Invalid YAML input returns structured error
- Missing paths handled gracefully

### Dependencies
- `js-yaml` (v4.x) — already a project dependency
- Built-in path-based access utilities

### Risks / Edge Cases
- Invalid YAML input
- Large YAML payloads
- YAML vs. JSON compatibility issues

## Goal 6: Data Transformation Tool

### Scope
- Convert between JSON, YAML, CSV, and other formats
- Support mapping rules for data transformation
- Use `csv-parse` and `csv-generate` (v6.x) for CSV handling
- Handle edge cases (invalid input, missing fields, encoding issues)

### Key Requirements
- Zod schema validation for all inputs
- Format conversion (JSON ↔ YAML ↔ CSV)
- Mapping rule support
- Error handling for invalid input

### Acceptance Criteria
- JSON to YAML conversion works
- YAML to JSON conversion works
- JSON to CSV conversion works
- CSV to JSON conversion works
- Mapping rules transform data correctly
- Invalid input returns structured error

### Dependencies
- `csv-parse` and `csv-generate` (v6.x)
- `js-yaml` (v4.x)
- Built-in JSON.parse/stringify

### Risks / Edge Cases
- Invalid input formats
- Missing required fields
- Encoding issues (UTF-8, ASCII)
- Large CSV files

## Goal 7: Tool Registration and Integration

### Scope
- Register all tools in `src/tools/index.js`
- Assign appropriate permissions (network:outbound for API calls, filesystem:read/write for data files)
- Follow existing tool pattern (zod schema, impl function, registration)

### Key Requirements
- Follow existing tool registration pattern
- Assign correct permission tiers
- JSDoc comments on all public functions
- Consistent error handling

### Acceptance Criteria
- All tools registered in index.js
- Permissions correctly assigned
- Tools discoverable via skills system
- JSDoc comments present

### Dependencies
- Existing tool registration in src/tools/index.js
- Existing permission model from src/skills/

### Risks / Edge Cases
- Permission conflicts
- Tool name collisions
- Missing JSDoc annotations

## Non-Goals
- Webhook delivery retries (deferred to follow-up)
- Webhook dashboard/UI (deferred to follow-up)
- GraphQL schema validation against remote schema (deferred to follow-up)
- Response caching for GET requests (deferred to follow-up)
- OAuth 2.0 authentication (deferred to follow-up)
- WebSocket support (deferred to follow-up)