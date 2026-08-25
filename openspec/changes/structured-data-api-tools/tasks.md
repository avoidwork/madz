## 1. Setup and Dependencies

- [ ] 1.1 Add npm dependencies: node-fetch, graphql-request, jsonpath-plus, js-yaml, csv-parse, csv-generate
- [ ] 1.2 Create src/tools/api/ directory structure with index.js and impl.js
- [ ] 1.3 Create src/tools/webhook/ directory structure with index.js and impl.js
- [ ] 1.4 Create src/tools/json/ directory structure with index.js and impl.js
- [ ] 1.5 Create src/tools/yaml/ directory structure with index.js and impl.js
- [ ] 1.6 Create src/tools/data-transform/ directory structure with index.js and impl.js

## 2. REST API Client (api tool)

- [ ] 2.1 Implement URL validation against allowlist with scheme blocking (file://, gopher://, dict://)
- [ ] 2.2 Implement internal IP blocking (127.0.0.1, 0.0.0.0, 169.254.169.254)
- [ ] 2.3 Implement Bearer token authentication header injection
- [ ] 2.4 Implement Basic authentication header injection
- [ ] 2.5 Implement API key authentication header injection
- [ ] 2.6 Implement configurable timeout with AbortController
- [ ] 2.7 Implement response header sanitization (strip Set-Cookie, WWW-Authenticate)
- [ ] 2.8 Implement response body size limit (default 10MB)
- [ ] 2.9 Implement GET request handler with node-fetch
- [ ] 2.10 Implement POST request handler with body serialization
- [ ] 2.11 Implement PUT request handler with body serialization
- [ ] 2.12 Implement DELETE request handler
- [ ] 2.13 Implement PATCH request handler with body serialization
- [ ] 2.14 Implement custom headers support with auth header precedence

## 3. GraphQL Client (api tool)

- [ ] 3.1 Implement GraphQL query execution via graphql-request
- [ ] 3.2 Implement GraphQL mutation execution with variables
- [ ] 3.3 Implement GraphQL introspection query support
- [ ] 3.4 Implement query depth limit enforcement (default: 10)
- [ ] 3.5 Implement query complexity limit enforcement (default: 1000)
- [ ] 3.6 Implement GraphQL error handling and response formatting

## 4. Webhook Management Tool

- [ ] 4.1 Implement webhook create action with URL and optional events
- [ ] 4.2 Implement webhook list action returning all registered endpoints
- [ ] 4.3 Implement webhook delete action by ID
- [ ] 4.4 Implement webhook secret storage (process.env only)
- [ ] 4.5 Implement HMAC-SHA256 signature verification using crypto.timingSafeEqual
- [ ] 4.6 Implement signature expiration check (default: 5 minute window)
- [ ] 4.7 Implement missing signature rejection (401 status)
- [ ] 4.8 Implement rate limiting per source IP (default: 100 req/min)
- [ ] 4.9 Implement rate limit window reset logic

## 5. JSON Manipulation Tool

- [ ] 5.1 Implement JSON parse action with error handling for malformed input
- [ ] 5.2 Implement JSON serialize action with configurable indentation
- [ ] 5.3 Implement JSON filter action using jsonpath-plus
- [ ] 5.4 Implement JSON transform action with field mapping rules
- [ ] 5.5 Implement JSON transform action with field removal rules
- [ ] 5.6 Implement structured error responses for parse failures

## 6. YAML Manipulation Tool

- [ ] 6.1 Implement YAML parse action with error handling for malformed input
- [ ] 6.2 Implement YAML serialize action with configurable indentation
- [ ] 6.3 Implement YAML filter action using JSONPath on parsed objects
- [ ] 6.4 Implement YAML multi-document parsing (--- separators)
- [ ] 6.5 Implement YAML multi-document serialization (array → multi-doc)
- [ ] 6.6 Implement structured error responses for parse failures

## 7. Data Transformation Tool

- [ ] 7.1 Implement JSON to YAML conversion
- [ ] 7.2 Implement YAML to JSON conversion
- [ ] 7.3 Implement JSON to CSV conversion with header derivation
- [ ] 7.4 Implement CSV to JSON conversion with header-based key mapping
- [ ] 7.5 Implement custom delimiter support for CSV operations
- [ ] 7.6 Implement field mapping rules during transformation
- [ ] 7.7 Implement field filtering during transformation
- [ ] 7.8 Implement error handling for unsupported format combinations

## 8. Tool Registration and Integration

- [ ] 8.1 Register api tool in src/tools/index.js with network:outbound permission
- [ ] 8.2 Register webhook tool in src/tools/index.js with network:outbound permission
- [ ] 8.3 Register json tool in src/tools/index.js with filesystem:read permission
- [ ] 8.4 Register yaml tool in src/tools/index.js with filesystem:read permission
- [ ] 8.5 Register data-transform tool in src/tools/index.js with filesystem:read permission
- [ ] 8.6 Export all tools from src/tools/index.js with proper Zod schemas
- [ ] 8.7 Update AGENTS.md with new tool documentation

## 9. Testing

- [ ] 9.1 Create tests/unit/tools/api.test.js with unit tests for REST API client
- [ ] 9.2 Create tests/unit/tools/webhook.test.js with unit tests for webhook management
- [ ] 9.3 Create tests/unit/tools/json.test.js with unit tests for JSON manipulation
- [ ] 9.4 Create tests/unit/tools/yaml.test.js with unit tests for YAML manipulation
- [ ] 9.5 Create tests/unit/tools/data-transform.test.js with unit tests for data transformation
- [ ] 9.6 Add mock HTTP server tests for REST and GraphQL operations
- [ ] 9.7 Add webhook HMAC verification tests with known secrets
- [ ] 9.8 Add edge case tests: invalid JSON/YAML, malformed GraphQL, missing headers

## 10. Verification and Cleanup

- [ ] 10.1 Run npm test and verify all tests pass
- [ ] 10.2 Run npm run lint and fix any lint errors
- [ ] 10.3 Run npm run coverage and verify coverage thresholds
- [ ] 10.4 Verify application starts with npm start
- [ ] 10.5 Mark all tasks complete in tasks.md
