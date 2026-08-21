## 1. Setup

- [ ] 1.1 Add dependencies to package.json (node-fetch, graphql-request, jsonpath-plus, csv-parse, csv-generate)
- [ ] 1.2 Create src/tools/apiClient/ directory structure
- [ ] 1.3 Create src/tools/webhooks/ directory structure
- [ ] 1.4 Create src/tools/data/ directory structure

## 2. REST API Client

- [ ] 2.1 Create zod input schema for REST API client (url, method, headers, body, auth, timeout)
- [ ] 2.2 Implement URL validation against allowlist (http/https only, block file://, gopher://, dict://)
- [ ] 2.3 Implement Bearer token authentication
- [ ] 2.4 Implement Basic authentication
- [ ] 2.5 Implement API Key authentication
- [ ] 2.6 Implement GET/POST/PUT/DELETE/PATCH methods
- [ ] 2.7 Implement configurable timeout (default 30s)
- [ ] 2.8 Implement response size limit (default 10MB)
- [ ] 2.9 Implement structured error handling

## 3. GraphQL Client

- [ ] 3.1 Create zod input schema for GraphQL client (url, query, variables, operationName, timeout)
- [ ] 3.2 Implement URL validation (same as REST API)
- [ ] 3.3 Implement query execution
- [ ] 3.4 Implement mutation execution
- [ ] 3.5 Implement schema introspection (configurable)
- [ ] 3.6 Implement query depth limiting (default 10)
- [ ] 3.7 Implement query complexity limiting (default 1000)
- [ ] 3.8 Implement configurable timeout (default 30s)
- [ ] 3.9 Implement structured error handling

## 4. Webhook Management

- [ ] 4.1 Create zod input schema for webhook management (action, url, secret, events, payload)
- [ ] 4.2 Implement webhook creation with unique ID generation
- [ ] 4.3 Implement webhook listing (secrets masked)
- [ ] 4.4 Implement webhook deletion
- [ ] 4.5 Implement HMAC-SHA256 signature verification
- [ ] 4.6 Implement timestamp validation (5-minute window)
- [ ] 4.7 Implement webhook delivery with error handling
- [ ] 4.8 Implement rate limiting (default 100/minute)

## 5. JSON Manipulation

- [ ] 5.1 Create zod input schema for JSON manipulation (action, input, path, mapping)
- [ ] 5.2 Implement JSON parsing with error handling
- [ ] 5.3 Implement JSON serialization with custom formatting
- [ ] 5.4 Implement JSONPath filtering with jsonpath-plus
- [ ] 5.5 Implement JSON transformation with mapping rules
- [ ] 5.6 Implement JSON validation against schema

## 6. YAML Manipulation

- [ ] 6.1 Create zod input schema for YAML manipulation (action, input, path, mapping)
- [ ] 6.2 Implement YAML parsing with js-yaml
- [ ] 6.3 Implement YAML serialization with custom formatting
- [ ] 6.4 Implement path-based YAML access
- [ ] 6.5 Implement YAML transformation with mapping rules
- [ ] 6.6 Implement YAML validation

## 7. Data Transformation

- [ ] 7.1 Create zod input schema for data transformation (action, input, fromFormat, toFormat, mapping)
- [ ] 7.2 Implement JSON to CSV conversion
- [ ] 7.3 Implement CSV to JSON conversion
- [ ] 7.4 Implement JSON to YAML conversion
- [ ] 7.5 Implement YAML to JSON conversion
- [ ] 7.6 Implement field mapping rules for all conversions
- [ ] 7.7 Implement error handling for invalid input formats

## 8. Tool Registration

- [ ] 8.1 Register all tools in src/tools/index.js with appropriate permissions
- [ ] 8.2 Ensure tools follow existing factory pattern
- [ ] 8.3 Set network:outbound permission for API/webhook tools
- [ ] 8.4 Set filesystem:read permission for data tools

## 9. Testing

- [ ] 9.1 Create tests/unit/tools/apiClient.test.js
- [ ] 9.2 Create tests/unit/tools/webhooks.test.js
- [ ] 9.3 Create tests/unit/tools/data.test.js
- [ ] 9.4 Test REST API client (all methods, auth types, URL validation, timeouts)
- [ ] 9.5 Test GraphQL client (queries, mutations, depth/complexity limits)
- [ ] 9.6 Test webhook management (create, list, delete, HMAC verification)
- [ ] 9.7 Test JSON manipulation (parse, serialize, JSONPath, transform)
- [ ] 9.8 Test YAML manipulation (parse, serialize, path access, transform)
- [ ] 9.9 Test data transformation (JSON↔CSV, JSON↔YAML, mapping rules)
- [ ] 9.10 Test edge cases (invalid input, missing fields, special characters)

## 10. Verification

- [ ] 10.1 Run npm run test
- [ ] 10.2 Run npm run lint
- [ ] 10.3 Run npm run coverage
- [ ] 10.4 Verify application starts (npm start with timeout)