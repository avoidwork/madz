## Why

The LangChain ReAct agent in madz currently has no tool integration, limiting it to simple conversational responses without the ability to read/write files, execute commands, search the web, or interact with external services. This change adds Tier 1 foundational tools — functions requiring zero external API keys — so the agent can perform real work: managing files, running shell commands, tracking tasks, persisting memory, and clarifying with the user.

## What Changes

- Add `src/tools/` directory with LangChain `@tool`-decorated tool functions
- Create `src/tools/common.js` with shared utilities (path resolution, URL filtering, timeout fetch)
- Create filesystem tools: `read_file`, `write_file`, `patch`, `search_files`
- Create terminal tools: `terminal`, `process`
- Create task management tool: `todo`
- Create memory tools: `memory`, `session_search`
- Create interaction tool: `clarify`
- Create skills management tools: `skills_list`, `skill_view`
- Add `buildToolConfig()` that registers tools based on sandbox permission gating
- Integrate tools with ReAct agent in `index.js` via `createReactAgent(model, tools)`
- Extend config schema with `permissions` and `maxReadSize` fields in sandbox config
- Add unit tests and tool registration tests for 100% coverage

## Capabilities

### New Capabilities
- `tools`: LangChain-native tool definitions, registration, and permission gating for Tier 1 foundational tools (filesystem, terminal, todo, memory, session search, clarify, skills list/view)

### Modified Capabilities
- `config-system`: Requires sandbox schema extension for `permissions` array and `maxReadSize` string fields
- `sandbox-rte`: Tool execution shares sandbox infrastructure (path resolution, URL filtering, timeout handling)

## Impact

- **New files**: `src/tools/index.js`, `src/tools/common.js`, `src/tools/filesystem.js`, `src/tools/terminal.js`, `src/tools/todo.js`, `src/tools/memory.js`, `src/tools/clarify.js`, `src/tools/skills.js`
- **Modified files**: `src/config/schemas.js` (sandbox schema extension), `index.js` (agent integration)
- **Config**: `config.yaml` needs `sandbox.permissions` and `sandbox.maxReadSize` additions
- **Dependencies**: Adds LangChain `@langchain/core/tools` (already present as LangGraph dependency)
- **Sandbox**: Reuses `src/sandbox/pathResolver.js`, `src/sandbox/urlFilter.js`, `src/sandbox/capability.js`, `src/sandbox/timeoutHandler.js`
- **Memory**: Writes to `memory/tools/todo.json`, `memory/context/session_memory.md`
