## Why

The existing toolset handles web search and content extraction but lacks structured API interaction capability. Office and marketing workflows frequently need to call REST APIs (CRM, analytics, project management), query GraphQL endpoints, manage webhooks, and manipulate JSON/YAML data. Currently the agent must fall back to shell commands (curl, jq, yq) or rely on ad-hoc LLM reasoning, which is inconsistent and error-prone.

## What Changes

- Add REST API client tool with authenticated GET/POST/PUT/DELETE/PATCH requests, configurable headers, body, and authentication (Bearer, Basic, API Key)
- Add GraphQL client tool for executing queries and mutations with schema introspection
- Add webhook management tool for creating, listing, and managing webhook endpoints with HMAC-SHA256 payload validation
- Add JSON manipulation tool for parsing, transforming, filtering, and serializing JSON with path-based access
- Add YAML manipulation tool for parsing, transforming, filtering, and serializing YAML with path-based access
- Add data transformation tool for converting between JSON, YAML, CSV formats with mapping rules
- Register all tools in `src/tools/index.js` with appropriate permissions
- Add dependencies: node-fetch, graphql-request, jsonpath-plus, js-yaml, csv-parse, csv-generate

## Capabilities

### New Capabilities
- `api`: REST API client with authentication and GraphQL query support
- `webhook`: Webhook endpoint management with HMAC-SHA256 signature verification
- `json`: JSON parsing, transformation, filtering, and serialization with JSONPath access
- `yaml`: YAML parsing, transformation, filtering, and serialization with path-based access
- `data-transform`: Cross-format data transformation (JSON ↔ YAML ↔ CSV) with mapping rules

### Modified Capabilities
- None

## Impact

- **Affected code:** `src/tools/index.js` (registration), `package.json` (new dependencies)
- **New files:** `src/tools/api/index.js`, `src/tools/webhook/index.js`, `src/tools/json/index.js`, `src/tools/yaml/index.js`, `src/tools/data-transform/index.js`
- **Dependencies:** node-fetch v3.x, graphql-request v6.x, jsonpath-plus v8.x, js-yaml v4.x, csv-parse v6.x, csv-generate v6.x
- **Permissions:** `network:outbound` for API/webhook tools, `filesystem:read/write` for data manipulation tools
- **Security:** URL allowlist validation, internal IP blocking, credential storage in process.env only, response sanitization

## Non-goals

- No embedded HTTP server for receiving webhooks (webhook tool manages endpoints only, does not host them)
- No OAuth 2.0 flow implementation (only Bearer, Basic, and API key auth)
- No webhook delivery retry logic (delivery is the responsibility of the webhook receiver)
- No streaming/sse support for API responses
- No connection pooling or request batching
