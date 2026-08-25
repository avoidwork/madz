## 1. Setup — Install Dependencies

- [ ] 1.1 Add npm dependencies: graphql-request, jsonpath-plus, js-yaml, csv-parse, csv-generate to package.json
- [ ] 1.2 Run npm install to install new dependencies

## 2. URL Allowlist Utility

- [ ] 2.1 Create src/tools/utils/urlAllowlist.js with allowlist validation function
- [ ] 2.2 Implement scheme blocking (file://, gopher://, dict://)
- [ ] 2.3 Implement internal IP blocking (127.0.0.1, 0.0.0.0, 169.254.169.254)
- [ ] 2.4 Allow configurable allowlist from config.yaml

## 3. REST API Client Tool

- [ ] 3.1 Create src/tools/api.js with REST API tool implementation
- [ ] 3.2 Implement Zod input schema: url, method, headers, body, auth, timeout
- [ ] 3.3 Implement authentication: bearer, basic, apikey
- [ ] 3.4 Implement URL allowlist enforcement
- [ ] 3.5 Implement response sanitization (strip Set-Cookie, WWW-Authenticate)
- [ ] 3.6 Implement response size limit (10MB default)
- [ ] 3.7 Implement configurable timeouts (default 30s)
- [ ] 3.8 Register tool in src/tools/index.js with network:outbound permission

## 4. GraphQL Client Tool

- [ ] 4.1 Create src/tools/graphql.js with GraphQL client tool implementation
- [ ] 4.2 Implement Zod input schema: url, query, variables, operationName, timeout
- [ ] 4.3 Implement query and mutation execution via graphql-request
- [ ] 4.4 Implement schema introspection support
- [ ] 4.5 Implement query depth limiting (default: 10)
- [ ] 4.6 Implement query complexity limiting (default: 1000)
- [ ] 4.7 Implement configurable timeouts (default 30s)
- [ ] 4.8 Register tool in src/tools/index.js with network:outbound permission

## 5. JSON Manipulation Tool

- [ ] 5.1 Create src/tools/json.js with JSON manipulation tool implementation
- [ ] 5.2 Implement Zod input schema: action, input, format, path, mapping
- [ ] 5.3 Implement parse action (JSON string → object)
- [ ] 5.4 Implement serialize action (object → JSON string)
- [ ] 5.5 Implement transform action with mapping rules
- [ ] 5.6 Implement filter action with JSONPath expressions via jsonpath-plus
- [ ] 5.7 Implement path-based access (dot notation, array indices)
- [ ] 5.8 Register tool in src/tools/index.js with filesystem:read permission

## 6. YAML Manipulation Tool

- [ ] 6.1 Create src/tools/yaml.js with YAML manipulation tool implementation
- [ ] 6.2 Implement Zod input schema: action, input, format, path, mapping
- [ ] 6.3 Implement parse action (YAML string → object)
- [ ] 6.4 Implement serialize action (object → YAML string)
- [ ] 6.5 Implement transform action with mapping rules
- [ ] 6.6 Implement filter action with path expressions
- [ ] 6.7 Implement path-based access (dot notation, array indices)
- [ ] 6.8 Register tool in src/tools/index.js with filesystem:read permission

## 7. Data Transformation Tool

- [ ] 7.1 Create src/tools/data.js with data transformation tool implementation
- [ ] 7.2 Implement Zod input schema: action, input, format, path, mapping
- [ ] 7.3 Implement JSON ↔ YAML conversion
- [ ] 7.4 Implement JSON ↔ CSV conversion via csv-parse/csv-generate
- [ ] 7.5 Implement mapping rule application during conversion
- [ ] 7.6 Implement input format validation
- [ ] 7.7 Register tool in src/tools/index.js with filesystem:read permission

## 8. Webhook Management Tool

- [ ] 8.1 Create src/tools/webhook.js with webhook management tool implementation
- [ ] 8.2 Implement Zod input schema: action, url, secret, events, payload
- [ ] 8.3 Implement create action — store webhook registration
- [ ] 8.4 Implement list action — return all registered webhooks
- [ ] 8.5 Implement delete action — remove webhook by ID
- [ ] 8.6 Implement verify action — HMAC-SHA256 signature verification
- [ ] 8.7 Implement persistence to data/webhooks.json
- [ ] 8.8 Register tool in src/tools/index.js with filesystem:read, filesystem:write permissions

## 9. Testing

- [ ] 9.1 Create tests/unit/api.test.js with REST client unit tests
- [ ] 9.2 Create tests/unit/graphql.test.js with GraphQL client unit tests
- [ ] 9.3 Create tests/unit/json.test.js with JSON manipulation unit tests
- [ ] 9.4 Create tests/unit/yaml.test.js with YAML manipulation unit tests
- [ ] 9.5 Create tests/unit/data.test.js with data transformation unit tests
- [ ] 9.6 Create tests/unit/webhook.test.js with webhook management unit tests
- [ ] 9.7 Create tests/integration/api.test.js with integration tests using mock server
- [ ] 9.8 Create tests/integration/webhook.test.js with webhook integration tests

## 10. Verification

- [ ] 10.1 Run npm run test and verify all tests pass
- [ ] 10.2 Run npm run lint and verify no lint errors
- [ ] 10.3 Run npm run coverage and verify coverage is maintained
