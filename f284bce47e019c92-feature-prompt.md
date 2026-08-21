CHANGE_NAME: add-structured-data-and-api-tools

## Summary

Add a suite of structured data and API interaction tools to the madz AI harness. This feature introduces REST API client, GraphQL client, webhook management, JSON manipulation, YAML manipulation, and data transformation tools — filling a critical gap in the tool ecosystem for office and marketing workflows.

## Technical Approach

The implementation follows the existing tool pattern in `src/tools/`: each tool is a plain async function with a Zod v4 input schema, an implementation function, and registration in `src/tools/index.js` with appropriate permission tiers. The tools are split across multiple files to maintain single responsibility:

- `src/tools/apiClient/index.js` — REST API client and GraphQL client (network:outbound permission)
- `src/tools/webhooks/index.js` — Webhook management with HMAC validation (network:outbound permission)
- `src/tools/data/index.js` — JSON, YAML, and CSV manipulation tools (filesystem:read permission)

For the REST API client, `node-fetch` (v3.x) provides a modern, zero-dependency HTTP client using the native fetch API. The GraphQL client uses `graphql-request` (v6.x) for lightweight query/mutation execution with schema introspection support. Webhook management uses Node.js built-in `http` module (no new dependency) for a lightweight embedded server with HMAC-SHA256 signature verification.

Security is paramount: all outbound URLs are validated against an allowlist (disallowing file://, gopher://, dict:// schemes and internal IPs), credentials are stored in process.env only, response body size is limited to 10MB, and sensitive headers are stripped from proxied responses. GraphQL queries are limited in depth (default: 10) and complexity (default: 1000). Rate limiting is implemented client-side (default: 10 requests/second) and webhook endpoints are rate-limited (default: 100 requests/minute per source IP).

The data manipulation tools use existing project dependencies where possible (`js-yaml` is already a dependency) and add `jsonpath-plus` (v8.x) for JSONPath support and `csv-parse`/`csv-generate` (v6.x) for CSV handling.

## Architectural Decisions

1. **Split into three tool groups**: api (REST + GraphQL), webhooks, and data (JSON/YAML/CSV). This keeps each tool focused and avoids a monolithic "api" tool.
2. **Use node-fetch over axios**: Zero dependencies, modern API, aligns with Node.js 24+ native fetch.
3. **Use Node.js built-in http for webhooks**: fastify adds a dependency; the built-in http module is sufficient for webhook management with HMAC validation.
4. **Reuse existing URL allowlist**: The sandbox's urlFilter.js pattern should be referenced for URL validation consistency.
5. **GraphQL introspection disabled by default**: Security-first approach; enable only when explicitly configured.

## Trade-offs

- **Webhook server in-process vs. external**: In-process keeps the architecture simple but ties webhook delivery to the madz process lifecycle. External webhook service would require additional infrastructure.
- **jsonpath-plus vs. custom path resolver**: jsonpath-plus is well-maintained and supports full JSONPath expressions. Custom resolver would reduce dependencies but lose feature parity.
- **csv-parse/generate vs. csv-stringify**: csv-parse and csv-generate are from the same author as csv-stringify (already used in the spreadsheet module), ensuring consistency and reliability.

## Open Questions

- Should the REST API client support connection pooling for repeated requests to the same host?
- Should webhook configurations be persisted to disk or kept in-memory only?
- Should the GraphQL client support subscription (WebSocket) or just queries/mutations?