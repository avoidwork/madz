## 1. Dependency

- [ ] 1.1 Add `@langchain/mcp-adapters` (^2.0.1) to `package.json` dependencies

## 2. Config Schema

- [ ] 2.1 Create `src/config/schemas/mcp.js` with `McpSchema` using `z.discriminatedUnion("transport", [...])` for `stdio`/`http`/`sse`, each server carrying an optional `agents` list
- [ ] 2.2 Re-export `McpSchema` from `src/config/schemas/index.js`
- [ ] 2.3 Add `mcp: McpSchema.default({})` to the root `ConfigSchema` in `src/config/config.js`
- [ ] 2.4 Add `mcp` to `DROPPED_KEYS` in `src/config/loader.js` so MCP server env vars map correctly

## 3. Tool Builder

- [ ] 3.1 In `src/tools/index.js`, construct an `MCPAdapter` from `config.mcp.servers` in `buildToolConfig()`, call `listTools()`, and append the returned `DynamicStructuredTool[]` to the `tools` array
- [ ] 3.2 Handle per-server connection failures gracefully (warn and skip, never crash startup)
- [ ] 3.3 Return the `MCPAdapter` (or a close function) from `buildToolConfig()` so the caller can close it on shutdown
- [ ] 3.4 Extend `getToolsForAgentTypes()` to account for dynamic MCP tool classifications derived from per-server `agents` config
- [ ] 3.5 Ensure `ORCHESTRATOR_TOOLS` filtering accounts for dynamic MCP tool names intended for the orchestrator

## 4. Agent Wiring

- [ ] 4.1 In `src/agent/deepAgents.js`, wire the MCP adapter's `close()` into shutdown
- [ ] 4.2 Extend `createSubagentDefinitions()` so MCP tools reach the correct subagents based on per-server `agents` classification

## 5. Tests

- [ ] 5.1 Add `tests/unit/config/schemas/mcp.test.js` validating the `mcp` Zod schema (transport enum, required fields per transport, env record shape, invalid config rejected)
- [ ] 5.2 Add tests for `buildToolConfig()` MCP tool discovery and per-server failure handling
- [ ] 5.3 Verify `npm run test`, `npm run lint`, and `npm run coverage` pass
