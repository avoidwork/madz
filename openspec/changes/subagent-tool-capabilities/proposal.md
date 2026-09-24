## Why

The orchestrator cannot see which tools each subagent carries. When asked to work with a .docx, it writes a script instead of delegating to the subagent that actually has the docx tool. The subagent's `description` — the only thing deepagents surfaces to the orchestrator via `describeSubagentForTool()` (`- <name>: <description>`) — never mentions its tools, so the orchestrator has no way to route document tasks to the tool-capable subagent.

## What Changes

- **Surface tool lists in subagent descriptions.** In `createSubagentDefinitions()` (`src/agent/deepAgents.js`), after `filteredToolNames` is computed via `getToolsForAgentTypes(classifications, TOOLS)`, build a comma-separated tool-list string and append it to the `description` field of the `definition` object, e.g. `` `${agentDef.description} Tools: ${filteredToolNames.join(", ")}` ``. This is the field deepagents renders to the orchestrator.
- **Preserve the existing `tools` array.** The `tools: filteredTools` array (actual tool instances) is unchanged; the description change is additive.
- **Omit the suffix for empty tool lists.** When `filteredToolNames` is empty, the `Tools:` suffix is omitted to avoid a misleading `Tools: ` line.
- **Add a unit test** verifying each subagent's description includes its tool list and that the tool names match `getToolsForAgentTypes()`.

## Capabilities

### New Capabilities
- `subagent-tool-visibility`: The orchestrator SHALL be able to see which tools each subagent carries, via the subagent's description, so it can delegate tool-specific tasks to the correct subagent.

### Modified Capabilities
<!-- No existing capability's requirements change; this is a new visibility contract. -->

## Impact

- **Affected code:** `src/agent/deepAgents.js` (`createSubagentDefinitions()`), `tests/unit/deepAgents.test.js`.
- **No dependency changes.** `getToolsForAgentTypes()` and `TOOLS` are already imported in `deepAgents.js`.
- **Behavior change:** The orchestrator's `task` tool description now lists each subagent's tools, enabling correct delegation of document-handling tasks (docx, pdf, pptx, xlsx) to the tool-capable subagents.

## Non-goals

- No changes to `TOOL_CLASSIFICATIONS`, permission gating, or tool registration in `src/tools/index.js`.
- No changes to the deepagents library or its `describeSubagentForTool()`.
- No integration test requiring a live LLM provider (the unit test is deterministic and sufficient for this routing fix).
