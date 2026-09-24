## 1. Surface tool lists in subagent descriptions

- [x] 1.1 In `createSubagentDefinitions()` in `src/agent/deepAgents.js`, after `filteredToolNames` is computed via `getToolsForAgentTypes(classifications, TOOLS)`, build a comma-separated tool-list string from it
- [x] 1.2 Append the tool list to the `description` field of the `definition` object, e.g. `` `${agentDef.description} Tools: ${filteredToolNames.join(", ")}` ``, omitting the `Tools:` suffix when `filteredToolNames` is empty
- [x] 1.3 Verify the existing `tools: filteredTools` array (actual tool instances) is preserved unchanged

## 2. Add unit test for subagent tool visibility

- [x] 2.1 Add a unit test in `tests/unit/deepAgents.test.js` verifying that each subagent's `description` includes a `Tools:` list
- [x] 2.2 Assert the tool names in the description match `getToolsForAgentTypes()` for that agent's classification
- [x] 2.3 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm no regressions
