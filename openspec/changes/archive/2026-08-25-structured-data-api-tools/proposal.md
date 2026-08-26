## Why

The existing tools handle web search and content extraction, but there is no structured API interaction capability. Office and marketing workflows frequently need to call REST APIs (CRM, analytics, project management), query GraphQL endpoints, manage webhooks, and manipulate JSON/YAML data. Currently the agent must fall back to shell commands (curl, jq, yq) or rely on ad-hoc LLM reasoning, which is inconsistent and error-prone.

## What Changes

- Add REST API client tool supporting authenticated GET/POST/PUT/DELETE/PATCH requests with configurable headers, body, and authentication (Bearer, Basic, API Key)
- Add GraphQL client tool for executing queries and mutations with schema introspection, depth/complexity limits
- Add JSON manipulation tool for parse, transform, filter, and serialize operations with JSONPath-based access
- Add YAML manipulation tool mirroring JSON tool structure with js-yaml parsing/dumping
- Add data transformation tool for format conversion between JSON, YAML, and CSV with mapping rules
- Add webhook management tool for create, list, delete, and verify (HMAC-SHA256) actions
- Register all tools in `src/tools/index.js` with appropriate permissions
- Add dependencies: graphql-request, jsonpath-plus, js-yaml, csv-parse, csv-generate

## Capabilities

### New Capabilities
- `api-client`: REST API client with authentication, timeout, URL allowlist, response sanitization
- `graphql-client`: GraphQL query/mutation execution with schema introspection and query limits
- `json-manipulation`: JSON parse, transform, filter, serialize with JSONPath-based access
- `yaml-manipulation`: YAML parse, transform, filter, serialize with path-based access
- `data-transformation`: Format conversion between JSON, YAML, CSV with mapping rules
- `webhook-management`: Webhook create, list, delete, verify with HMAC-SHA256 validation

### Modified Capabilities
- None

## Impact

- New files: `src/tools/api.js`, `src/tools/graphql.js`, `src/tools/json.js`, `src/tools/yaml.js`, `src/tools/data.js`, `src/tools/webhook.js`
- Modified: `src/tools/index.js` (register new tools), `package.json` (add dependencies)
- New tests: `tests/api.test.js`, `tests/graphql.test.js`, `tests/json.test.js`, `tests/yaml.test.js`, `tests/data.test.js`, `tests/webhook.test.js`
- New config: `data/webhooks.json` (webhook registrations)
- Security: All network tools enforce URL allowlist per AGENTS.md §1.2
- Permissions: Network tools require `network:outbound`; data tools require `filesystem:read/write`

## Non-goals

- Subscription support for GraphQL (out of scope for v1)
- Embedded webhook server (agent-facing tool only; no server component)
- File I/O for JSON/YAML/CSV tools (in-memory operations only)
- OAuth/OIDC authentication flows (Bearer, Basic, API Key only)
- Response caching (considered but deferred)
