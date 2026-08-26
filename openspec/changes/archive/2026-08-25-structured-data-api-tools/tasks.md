## 1. Setup — Install Dependencies

- [x] 1.1 Add npm dependencies: graphql-request, jsonpath-plus, js-yaml, csv-parse, csv-generate to package.json
- [x] 1.2 Run npm install to install new dependencies

## 2. URL Allowlist Utility

- [x] 2.1 Create src/tools/utils/urlAllowlist.js with allowlist validation function
- [x] 2.2 Implement scheme blocking (file://, gopher://, dict://)
- [x] 2.3 Implement internal IP blocking (127.0.0.1, 0.0.0.0, 169.254.169.254)
- [x] 2.4 Allow configurable allowlist from config.yaml

## 3. REST API Client Tool

- [x] 3.1 Create src/tools/api.js with REST API tool implementation
- [x] 3.2 Implement Zod input schema: url, method, headers, body, auth, timeout
- [x] 3.3 Implement authentication: bearer, basic, apikey
- [x] 3.4 Implement URL allowlist enforcement
- [x] 3.5 Implement response sanitization (strip Set-Cookie, WWW-Authenticate)
- [x] 3.6 Implement response size limit (10MB default)
- [x] 3.7 Implement configurable timeouts (default 30s)
- [x] 3.8 Register tool in src/tools/index.js with network:outbound permission

## 4. GraphQL Client Tool

- [x] 4.1 Create src/tools/graphql.js with GraphQL client tool implementation
- [x] 4.2 Implement Zod input schema: url, query, variables, operationName, timeout
- [x] 4.3 Implement query and mutation execution via graphql-request
- [x] 4.4 Implement schema introspection support
- [x] 4.5 Implement query depth limiting (default: 10)
- [x] 4.6 Implement query complexity limiting (default: 1000)
- [x] 4.7 Implement configurable timeouts (default 30s)
- [x] 4.8 Register tool in src/tools/index.js with network:outbound permission

## 5. JSON Manipulation Tool

- [x] 5.1 Create src/tools/json.js with JSON manipulation tool implementation
- [x] 5.2 Implement Zod input schema: action, input, format, path, mapping
- [x] 5.3 Implement parse action (JSON string → object)
- [x] 5.4 Implement serialize action (object → JSON string)
- [x] 5.5 Implement transform action with mapping rules
- [x] 5.6 Implement filter action with JSONPath expressions via jsonpath-plus
- [x] 5.7 Implement path-based access (dot notation, array indices)
- [x] 5.8 Register tool in src/tools/index.js with filesystem:read permission

## 6. YAML Manipulation Tool

- [x] 6.1 Create src/tools/yaml.js with YAML manipulation tool implementation
- [x] 6.2 Implement Zod input schema: action, input, format, path, mapping
- [x] 6.3 Implement parse action (YAML string → object)
- [x] 6.4 Implement serialize action (object → YAML string)
- [x] 6.5 Implement transform action with mapping rules
- [x] 6.6 Implement filter action with path expressions
- [x] 6.7 Implement path-based access (dot notation, array indices)
- [x] 6.8 Register tool in src/tools/index.js with filesystem:read permission

## 7. Data Transformation Tool

- [x] 7.1 Create src/tools/data.js with data transformation tool implementation
- [x] 7.2 Implement Zod input schema: action, input, format, path, mapping
- [x] 7.3 Implement JSON ↔ YAML conversion
- [x] 7.4 Implement JSON ↔ CSV conversion via csv-parse/csv-generate
- [x] 7.5 Implement mapping rule application during conversion
- [x] 7.6 Implement input format validation
- [x] 7.7 Register tool in src/tools/index.js with filesystem:read permission

## 8. Webhook Management Tool

- [x] 8.1 Create src/tools/webhook.js with webhook management tool implementation
- [x] 8.2 Implement Zod input schema: action, url, secret, events, payload
- [x] 8.3 Implement create action — store webhook registration
- [x] 8.4 Implement list action — return all registered webhooks
- [x] 8.5 Implement delete action — remove webhook by ID
- [x] 8.6 Implement verify action — HMAC-SHA256 signature verification
- [x] 8.7 Implement persistence to data/webhooks.json
- [x] 8.8 Register tool in src/tools/index.js with filesystem:read, filesystem:write permissions

## 9. Testing

- [x] 9.1 Create tests/unit/api.test.js with REST client unit tests
- [x] 9.2 Create tests/unit/graphql.test.js with GraphQL client unit tests
- [x] 9.3 Create tests/unit/json.test.js with JSON manipulation unit tests
- [x] 9.4 Create tests/unit/yaml.test.js with YAML manipulation unit tests
- [x] 9.5 Create tests/unit/data.test.js with data transformation unit tests
- [x] 9.6 Create tests/unit/webhook.test.js with webhook management unit tests
- [x] 9.7 Create tests/integration/api.test.js with integration tests using mock server
- [x] 9.8 Create tests/integration/webhook.test.js with webhook integration tests

## 10. Verification

- [x] 10.1 Run npm run test and verify all tests pass
- [x] 10.2 Run npm run lint and verify no lint errors
- [x] 10.3 Run npm run coverage and verify coverage is maintained
