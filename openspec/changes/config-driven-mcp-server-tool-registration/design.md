## Context

madz registers a fixed set of built-in LangChain tools in `src/tools/index.js`. The `TOOLS` map is static and keyed by name; `buildToolConfig()` gates each tool by sandbox permissions and API keys. Subagents receive tools via `getToolsForAgentTypes(classifications, TOOLS)`, which reads the static `TOOLS` map. The orchestrator receives tools filtered by the static `ORCHESTRATOR_TOOLS` set.

MCP servers expose tools dynamically at runtime. There is no way to register them today. This design adds a config-driven `mcp` section so users can declare MCP servers and have their tools discovered at startup and registered alongside built-in tools.

## Goals / Non-Goals

**Goals:**
- Add a root-level `mcp` config key with a `servers` map supporting `stdio`, `http` (Streamable HTTP), and `sse` transports.
- Discover MCP tools at startup via `MCPAdapter.listTools()` and register them alongside built-in tools.
- Keep the MCP adapter open for the agent's lifetime and close it on shutdown.
- Handle per-server connection failures gracefully (warn and skip, never crash startup).
- Classify MCP tools per server so they reach the correct subagents and/or orchestrator.

**Non-Goals:**
- No static wrapper per MCP server.
- No use of the deprecated `MultiServerMCPClient` / `mcpServers` / `getTools()` API.
- No MCP resource/prompt exposure (only tools).
- No per-tool permission gating beyond the per-server `agents` classification.

## Decisions

### Decision 1: Use `@langchain/mcp-adapters` v2 `MCPAdapter` with `{ servers: { ... } }`
The v2 API uses `MCPAdapter` constructed with `{ servers: { <name>: <connection> } }` and `listTools()` to discover tools. The deprecated `MultiServerMCPClient` / `getTools()` API is rejected by the issue. `MCPAdapter.listTools()` returns a flattened `DynamicStructuredTool[]`, and `close()` closes all connections.

### Decision 2: Config schema uses `z.discriminatedUnion("transport", [...])`
The `mcp.servers` value is a discriminated union on `transport` with three variants:
- `stdio` — `{ transport: "stdio", command, args, env? }`
- `http` — `{ transport: "http", url }`
- `sse` — `{ transport: "sse", url }`

This mirrors `@langchain/mcp-adapters` v2's `Connection` schema. Each server also carries an optional `agents` list (default `["orchestrator"]`) for classification.

### Decision 3: MCP tools are appended to the tool list, not added to `TOOLS`
MCP tools are dynamic and unknown at module load. `buildToolConfig()` constructs the `MCPAdapter`, calls `listTools()`, and appends the returned tools to the `tools` array. The adapter is returned alongside the tools so the caller can close it on shutdown.

### Decision 4: Per-server `agents` list drives classification
Each server config may specify `agents: ["coding", "research"]`. Tools from that server are assigned to those agent types. If `agents` is absent, tools default to the orchestrator only. This extends `getToolsForAgentTypes()` to consult MCP tool classifications derived from config.

### Decision 5: Orchestrator filtering accounts for dynamic MCP tool names
`ORCHESTRATOR_TOOLS` is a static set. MCP tools intended for the orchestrator (those whose server lists `orchestrator` in `agents`) must not be dropped. The orchestrator filter is extended to include MCP tools whose classification includes `orchestrator`.

### Decision 6: `mcp` is dropped from env-var prefixes
MCP server env vars (e.g., `mcp.servers.<name>.env.API_KEY`) should map to `MCP_SERVERS_<NAME>_ENV_API_KEY`. Adding `mcp` to `DROPPED_KEYS` keeps `servers` as the leading env-var segment, matching the schema-driven reverse map.

## Risks / Trade-offs

- [Per-server connection failure] → `listTools()` with `onConnectionError: "ignore"` skips failed servers; wrap in try/catch and log a warning, never crash startup.
- [Duplicate tool names across servers] → `MCPAdapter.listTools()` throws if two tools share a name; per-server `agents` classification and server-name prefixes mitigate. Failures are caught and logged.
- [stdio servers execute arbitrary local commands] → Treat as privileged; only register when the server is explicitly configured. Document as a security consideration.
- [Adapter lifecycle] → The adapter must be closed on shutdown. `buildToolConfig()` returns the adapter; the caller wires it into shutdown.

## Migration Plan

No migration required — the `mcp` section is optional and defaults to an empty object (no-op). Existing configs are unaffected.

## Open Questions

- Should MCP tool names be prefixed with the server name to avoid collisions? The issue notes naming/prefix collision as an edge case; `MCPAdapter` supports `prefixToolNameWithServerName` / `additionalToolNamePrefix`. Default to no prefix unless a collision is detected.
