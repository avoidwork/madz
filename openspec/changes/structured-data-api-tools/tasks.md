## 1. Setup and Dependencies

- [x] 1.1 Add npm dependencies: node-fetch, graphql-request, jsonpath-plus, js-yaml, csv-parse, csv-generate
- [x] 1.2 Create src/tools/api/ directory structure with index.js and impl.js
- [x] 1.3 Create src/tools/webhook/ directory structure with index.js and impl.js
- [x] 1.4 Create src/tools/json/ directory structure with index.js and impl.js
- [x] 1.5 Create src/tools/yaml/ directory structure with index.js and impl.js
- [x] 1.6 Create src/tools/data-transform/ directory structure with index.js and impl.js

## 2. REST API Client (api tool)

- [x] 2.1 Implement URL validation against allowlist with scheme blocking (file://, gopher://, dict://)
- [x] 2.2 Implement internal IP blocking (127.0.0.1, 0.0.0.0, 169.254.169.254)
- [x] 2.3 Implement Bearer token authentication header injection
- [x] 2.4 Implement Basic authentication header injection
- [x] 2.5 Implement API key authentication header injection
- [x] 2.6 Implement configurable timeout with AbortController
- [x] 2.7 Implement response header sanitization (strip Set-Cookie, WWW-Authenticate)
- [x] 2.8 Implement response body size limit (default 10MB)
- [x] 2.9 Implement GET request handler with node-fetch
- [x] 2.10 Implement POST request handler with body serialization
- [x] 2.11 Implement PUT request handler with body serialization
- [x] 2.12 Implement DELETE request handler
- [x] 2.13 Implement PATCH request handler with body serialization
- [x] 2.14 Implement custom headers support with auth header precedence

## 3. GraphQL Client (api tool)

- [x] 3.1 Implement GraphQL query execution via graphql-request
- [x] 3.2 Implement GraphQL mutation execution with variables
- [x] 3.3 Implement GraphQL introspection query support
- [x] 3.4 Implement query depth limit enforcement (default: 10)
- [x] 3.5 Implement query complexity limit enforcement (default: 1000)
- [x] 3.6 Implement GraphQL error handling and response formatting

## 4. Webhook Management Tool

- [x] 4.1 Implement webhook create action with URL and optional events
- [x] 4.2 Implement webhook list action returning all registered endpoints
- [x] 4.3 Implement webhook delete action by ID
- [x] 4.4 Implement webhook secret storage (process.env only)
- [x] 4.5 Implement HMAC-SHA256 signature verification using crypto.timingSafeEqual
- [x] 4.6 Implement signature expiration check (default: 5 minute window)
- [x] 4.7 Implement missing signature rejection (401 status)
- [x] 4.8 Implement rate limiting per source IP (default: 100 req/min)
- [x] 4.9 Implement rate limit window reset logic

## 5. JSON Manipulation Tool

- [x] 5.1 Implement JSON parse action with error handling for malformed input
- [x] 5.2 Implement JSON serialize action with configurable indentation
- [x] 5.3 Implement JSON filter action using jsonpath-plus
- [x] 5.4 Implement JSON transform action with field mapping rules
- [x] 5.5 Implement JSON transform action with field removal rules
- [x] 5.6 Implement structured error responses for parse failures

## 6. YAML Manipulation Tool

- [x] 6.1 Implement YAML parse action with error handling for malformed input
- [x] 6.2 Implement YAML serialize action with configurable indentation
- [x] 6.3 Implement YAML filter action using JSONPath on parsed objects
- [x] 6.4 Implement YAML multi-document parsing (--- separators)
- [x] 6.5 Implement YAML multi-document serialization (array → multi-doc)
- [x] 6.6 Implement structured error responses for parse failures

## 7. Data Transformation Tool

- [x] 7.1 Implement JSON to YAML conversion
- [x] 7.2 Implement YAML to JSON conversion
- [x] 7.3 Implement JSON to CSV conversion with header derivation
- [x] 7.4 Implement CSV to JSON conversion with header-based key mapping
- [x] 7.5 Implement custom delimiter support for CSV operations
- [x] 7.6 Implement field mapping rules during transformation
- [x] 7.7 Implement field filtering during transformation
- [x] 7.8 Implement error handling for unsupported format combinations

## 8. Tool Registration and Integration

- [x] 8.1 Register api tool in src/tools/index.js with network:outbound permission
- [x] 8.2 Register webhook tool in src/tools/index.js with network:outbound permission
- [x] 8.3 Register json tool in src/tools/index.js with filesystem:read permission
- [x] 8.4 Register yaml tool in src/tools/index.js with filesystem:read permission
- [x] 8.5 Register data-transform tool in src/tools/index.js with filesystem:read permission
- [x] 8.6 Export all tools from src/tools/index.js with proper Zod schemas
- [x] 8.7 Update AGENTS.md with new tool documentation

## 9. Testing

- [x] 9.1 Create tests/unit/tools/api.test.js with unit tests for REST API client
- [x] 9.2 Create tests/unit/tools/webhook.test.js with unit tests for webhook management
- [x] 9.3 Create tests/unit/tools/json.test.js with unit tests for JSON manipulation
- [x] 9.4 Create tests/unit/tools/yaml.test.js with unit tests for YAML manipulation
- [x] 9.5 Create tests/unit/tools/data-transform.test.js with unit tests for data transformation
- [x] 9.6 Add mock HTTP server tests for REST and GraphQL operations
- [x] 9.7 Add webhook HMAC verification tests with known secrets
- [x] 9.8 Add edge case tests: invalid JSON/YAML, malformed GraphQL, missing headers

## 10. Verification and Cleanup

- [x] 10.1 Run npm test and verify all tests pass
- [x] 10.2 Run npm run lint and fix any lint errors
- [x] 10.3 Run npm run coverage and verify coverage thresholds
- [x] 10.4 Verify application starts with npm start
- [x] 10.5 Mark all tasks complete in tasks.md
