## Context

The orchestrator routes tasks to subagents via a `task` tool whose description is built from each subagent's `name` and `description`. Deepagents renders this via `describeSubagentForTool(name, description, ...)` in `node_modules/deepagents/dist/langsmith-3LzYb-m7.js:3637`, producing lines like `- <name>: <description>`.

In `createSubagentDefinitions()` (`src/agent/deepAgents.js`), each subagent's `tools` array is populated with actual tool instances (`filteredTools`), but the `description` field — the only thing surfaced to the orchestrator — is left untouched. As a result, the orchestrator cannot see which tools a subagent carries. When asked to work with a `.docx`, it improvises by writing a script rather than delegating to the documentation/coding/search/research/debug subagent that has the `docx` tool.

The source of truth for which tools each agent gets is `getToolsForAgentTypes(classifications, TOOLS)` in `src/tools/index.js`, keyed by `TOOL_CLASSIFICATIONS`. The base descriptions live in `src/agent/agentDefinitions.js`.

## Goals / Non-Goals

**Goals:**
- Surface each subagent's tool list in its `description` so the orchestrator can see tool capabilities.
- Preserve the existing `tools` array (actual tool instances) unchanged.
- Add a deterministic unit test verifying the description includes the tool list and that it matches `getToolsForAgentTypes()`.

**Non-Goals:**
- Changing `TOOL_CLASSIFICATIONS`, permission gating, or tool registration.
- Modifying the deepagents library or `describeSubagentForTool()`.
- Adding an integration test that requires a live LLM provider.

## Decisions

### Decision 1: Fold the tool list into `description` rather than adding a new field
`describeSubagentForTool()` only renders `name` and `description`. Adding a separate field (e.g. `toolsDescription`) would not reach the orchestrator. Folding the list into `description` is the minimal change that achieves visibility.

**Alternative considered:** Adding a new `toolsDescription` field on the definition. Rejected because deepagents ignores it — only `name` and `description` are rendered.

### Decision 2: Omit the `Tools:` suffix when the tool list is empty
If an agent has no tools, appending `Tools: ` would render a misleading empty suffix. The suffix is only appended when `filteredToolNames.length > 0`.

### Decision 3: Derive the tool list from `filteredToolNames`, not `filteredTools`
`filteredToolNames` is the array of tool-name strings returned by `getToolsForAgentTypes()`. It is the natural, already-computed source for the comma-separated list. `filteredTools` maps names to instances and is preserved for the `tools` array.

### Decision 4: Deterministic ordering
`filteredToolNames` derives from `Object.keys(tools)`, so the ordering is stable across runs. The test asserts the exact comma-separated string.

## Risks / Trade-offs

- **[Longer descriptions]** → Each subagent description grows with its tool list. This is acceptable: the orchestrator needs the capability signal, and the lists are bounded by the tool set.
- **[Description drift]** → If `TOOL_CLASSIFICATIONS` changes, the description updates automatically because it is derived from `getToolsForAgentTypes()` at runtime. No manual sync required.
- **[No integration coverage]** → The unit test verifies the description contract deterministically. A live-provider integration test is out of scope and would be flaky in CI.
