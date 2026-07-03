## Why

The orchestrator and subagents in `src/agent/deepAgents.js` currently receive identical, full sets of tools and skills. This is architecturally unsound — the orchestrator should only have coordination tools (delegation, routing, synthesis) while subagents should have execution tools (code editing, terminal access, file operations). Giving everything to the orchestrator is inefficient and makes it harder to reason about agent capabilities.

## What Changes

- Add a `TOOL_CLASSIFICATIONS` map in `src/tools/index.js` that classifies each tool as `orchestrator`, `subagent`, or `shared`
- Modify `buildToolConfig()` in `src/tools/index.js` to accept an optional `classificationFilter` parameter that filters tools by classification
- Update `createDeepAgentsOrchestrator()` in `src/agent/deepAgents.js` to call `buildToolConfig()` twice — once for the orchestrator and once for the coding subagent — each with the appropriate filter
- Filter skill paths so the orchestrator receives only orchestrator-classified and shared skills (initially: no skills for orchestrator, all skills for subagents)
- Add inline documentation explaining the classification system and agent-specific tool assignments

## Capabilities

### New Capabilities
- `tool-classification`: Classification schema for tools (orchestrator, subagent, shared) with filtering support in `buildToolConfig()`
- `agent-tool-assignment`: Agent-specific tool assignment in `deepAgents.js` based on classification filters

### Modified Capabilities
<!-- No existing capabilities are being modified at the spec level -->

## Impact

- `src/tools/index.js` — New `TOOL_CLASSIFICATIONS` map, modified `buildToolConfig()` signature
- `src/agent/deepAgents.js` — Modified tool assignment logic, skill path filtering
- `docs/OVERVIEW.md` — Architecture documentation update
- Backward compatible: `buildToolConfig()` without `classificationFilter` includes all tools