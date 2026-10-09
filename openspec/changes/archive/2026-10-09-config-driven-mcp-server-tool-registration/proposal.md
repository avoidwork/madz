## Why

madz only supports its built-in LangChain tools. Users who want to reach an MCP server (filesystem, database, GitHub, Stripe, etc.) have no way to register it without forking the code. A config-driven `mcp` section lets users plug in any MCP server declaratively, matching how the rest of the config works.

## What Changes

- Add a root-level `mcp` config key with a `servers` map. Each server specifies a transport and connection params:
  - `stdio` — `{ transport: "stdio", command, args, env? }` (local process-spawned server)
  - `http` — `{ transport: "http", url }` (Streamable HTTP, the default for remote servers)
  - `sse` — `{ transport: "sse", url }` (HTTP + SSE, backwards compatibility)
- At startup, connect to each server, discover tools via `MCPAdapter.listTools()` (from `@langchain/mcp-adapters` v2), and register them alongside built-in tools.
- The adapter stays open for the agent's lifetime and is closed on shutdown.
- MCP tools are dynamic (discovered at runtime), so they are appended to the tool list rather than added to the static `TOOLS` map.
- A config-driven classification (per-server `agents` list) determines which agent types receive which MCP tools.
- Add `@langchain/mcp-adapters` (^2.0.1) dependency.

## Capabilities

### New Capabilities
- `mcp-server-tools`: Config-driven registration of MCP servers (stdio/http/sse transports), runtime tool discovery via `MCPAdapter.listTools()`, graceful per-server failure handling, and per-server agent classification for subagent assignment.

### Modified Capabilities
- `tool-classification`: MCP tools are dynamic and not in the static `TOOL_CLASSIFICATIONS` map; classification is derived from a per-server `agents` config list instead.
- `config-system`: The root `ConfigSchema` gains a new `mcp` section with a `servers` record.

## Impact

- **Code**: `src/config/schemas/mcp.js` (new), `src/config/schemas/index.js`, `src/config/config.js`, `src/config/loader.js`, `src/tools/index.js`, `src/agent/deepAgents.js`.
- **Dependencies**: `@langchain/mcp-adapters` (^2.0.1) added to `package.json`.
- **Config**: New optional `mcp` section in `config.yaml`; absent by default (no-op).
- **Tests**: New unit tests for the `mcp` schema and MCP tool discovery.
