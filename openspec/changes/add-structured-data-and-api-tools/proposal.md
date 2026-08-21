## Why

Office and marketing workflows frequently need to call REST APIs (CRM, analytics, project management), query GraphQL endpoints, manage webhooks, and manipulate JSON/YAML data. Currently the agent must fall back to shell commands (curl, jq, yq) or rely on ad-hoc LLM reasoning, which is inconsistent and error-prone.

## What Changes

- Add REST API client tool supporting GET/POST/PUT/DELETE/PATCH with authentication (Bearer, Basic, API Key)
- Add GraphQL client tool supporting queries, mutations, and schema introspection
- Add webhook management tool with HMAC-SHA256 signature verification
- Add JSON manipulation tool with JSONPath support
- Add YAML manipulation tool with path-based access
- Add data transformation tool for JSON/YAML/CSV conversion
- Add node-fetch, graphql-request, jsonpath-plus, csv-parse, csv-generate as dependencies
- Register all tools in src/tools/index.js with appropriate permissions

## Capabilities

### New Capabilities
- `api-client`: REST API client with authentication, URL validation, rate limiting, and timeout support
- `graphql-client`: GraphQL query/mutation client with depth/complexity limits and introspection
- `webhook-management`: Webhook creation, listing, deletion, and HMAC signature verification
- `json-manipulation`: JSON parsing, filtering, transformation, and serialization with JSONPath support
- `yaml-manipulation`: YAML parsing, filtering, transformation, and serialization
- `data-transformation`: Format conversion between JSON, YAML, and CSV with mapping rules

### Modified Capabilities
- None — all new capabilities

## Impact

- **New files**: src/tools/apiClient/index.js, src/tools/apiClient/graphql.js, src/tools/webhooks/index.js, src/tools/data/index.js, tests/unit/tools/ for each
- **Modified files**: src/tools/index.js (tool registration), package.json (new dependencies)
- **New dependencies**: node-fetch (v3.x), graphql-request (v6.x), jsonpath-plus (v8.x), csv-parse (v6.x), csv-generate (v6.x)
- **Security**: URL allowlist validation, credential storage in env only, response size limits, GraphQL depth/complexity limits, HMAC webhook verification
- **Permissions**: network:outbound for API/webhook tools, filesystem:read for data tools

## Non-goals

- OAuth 2.0 authentication (deferred)
- WebSocket support (deferred)
- Webhook delivery retries (deferred)
- Response caching for GET requests (deferred)
- GraphQL subscriptions (deferred)
- Webhook dashboard/UI (deferred)