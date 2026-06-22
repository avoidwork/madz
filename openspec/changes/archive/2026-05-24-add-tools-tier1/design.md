## Context

The madz harness uses a LangChain ReAct agent that currently has no tool integration. The project has existing sandbox infrastructure (`pathResolver`, `urlFilter`, `capability`, `timeoutHandler`, `permissions`) used for skill execution. Tools will reuse this infrastructure.

Current project structure relevant to this change:
- `src/sandbox/pathResolver.js` — resolves file paths against sandbox allowlist
- `src/sandbox/urlFilter.js` — blocks forbidden URL schemes (`file://`, `gopher://`, `dict://`)
- `src/sandbox/capability.js` — capability model for sandbox features
- `src/sandbox/timeoutHandler.js` — timeout enforcement with grace period
- `src/registry/permissions.js` — resolves permission scopes
- `src/config/schemas.js` — zod schemas for `config.yaml` validation
- `src/registry/types.js` — SkillRegistry type definitions (used by `skills_list`)
- `index.js` — application entry point where agent is created with `createReactAgent`

LangChain's `@tool` decorator creates schema-gated tool functions for LangGraph's ReAct agent.

## Goals / Non-Goals

**Goals:**
- Implement 12 Tier 1 tools as LangChain `@tool` decorated functions
- Create `buildToolConfig()` that registers tools based on `config.sandbox.permissions`
- Extend sandbox config schema with `permissions` array and `maxReadSize` string
- File persistence for todos (`memory/tools/todo.json`) and memory entries (`memory/context/session_memory.md`)
- Session search scans `memory/sessions/` for `.md` conversation files
- Shared utility module `src/tools/common.js`
- 100% test coverage with unit tests mirroring source structure

**Non-Goals:**
- Tier 2 tools (web_search, web_extract, image_generate, vision_analyze, text_to_speech, execute_code, cronjob, mixture_of_agents)
- Browser tools, CDP tools, platform integrations
- TUI panel for tool output display
- File locking for concurrent access protection

## Decisions

### Decision 1: LangChain @tool over custom dispatcher
Use `import { tool } from "@langchain/core/tools"` for all tool definitions. The project already depends on LangGraph, so LangChain Core is available. This provides automatic schema validation, LLM prompt description injection, and native integration with `createReactAgent`.

### Decision 2: Permission gating at registration
Tools are gated by checking `config.sandbox.permissions` at the time `buildToolConfig()` is called, not per-invocation. This keeps the agent's tool surface minimal and auditable. If permissions change at runtime (via `:config set`), the agent must be restarted for changes to take effect.

### Decision 3: File persistence location under memory/
Todos → `memory/tools/todo.json`, Memory entries → `memory/context/session_memory.md`, Clarifications → `memory/context/clarifications.md`. This follows the existing pattern in `src/memory/context.js` which loads from `contextDir` (defaults to `memory/context/`).

### Decision 4: Terminal uses spawn with sh -c
Execute via `child_process.spawn("sh", ["-c", command])` with maxBuffer limit. This is safer than `exec` for argument handling and supports background mode via `detached: true`. The `process` tool manages the returned `ChildProcess` objects for background management.

### Decision 5: Patch uses 9 fuzzy strategies
Implement exact, trim-trailing-whitespace, trim-leading-whitespace, collapse-whitespace, case-insensitive, normalized-newlines, normalized-tab/space, stripped-comments, and loose-substring strategies. If none match, return an error with suggestions.

### Decision 6: Clarify returns open-ended prompt
No choice mechanism since TUI is terminal-based. The tool stores the question in `memory/context/clarifications.md` and returns a structured response. The TUI displays it, and the user's next message becomes the agent's answer.

## Implementation Structure

```
src/tools/
├── index.js           → buildToolConfig(config) → Tool[]
├── common.js          → validatePath, validateUrl, fetchWithTimeout
├── filesystem.js      → read_file, write_file, patch, search_files
├── terminal.js        → terminal, process
├── todo.js            → todo
├── memory.js          → memory, session_search
├── clarify.js         → clarify
└── skills.js          → skills_list, skill_view
```

### Tool Module Pattern
Each tool is exported as a named constant from its module file:
```javascript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const read_file = tool(async (input) => {
  // implementation
}, {
  name: "read_file",
  description: "...",
  schema: z.object({ ... }),
});
```

### Permission Map
```javascript
const TOOL_PERMISSIONS = {
  "read_file": ["filesystem:read"],
  "write_file": ["filesystem:write"],
  "patch": ["filesystem:write"],
  "search_files": ["filesystem:read"],
  "terminal": ["filesystem:exec", "process:spawn"],
  "process": ["process:spawn"],
  "todo": ["filesystem:read", "filesystem:write"],
  "memory": ["filesystem:read", "filesystem:write"],
  "session_search": ["filesystem:read"],
  "clarify": [],              // no permissions required
  "skills_list": ["filesystem:read"],
  "skill_view": ["filesystem:read"],
};
```

### buildToolConfig Flow
1. Receive `config` (loaded `config.yaml` object with zod validation already applied)
2. Extract `config.sandbox.permissions` (defaults to `[]`)
3. Extract `config.sandbox.maxReadSize` (defaults to `"1mb"`)
4. For each tool in `TOOL_PERMISSIONS`:
   a. Check if all required permissions are in the enabled set
   b. If yes, import and add to toolsets array
5. Return the toolsets array to be passed to `createReactAgent`

### Integration With index.js
```javascript
// Before: const agent = createReactAgent(model, []);
// After:
const tools = await buildToolConfig(config);
const agent = createReactAgent(model, tools);
```

## Risks / Trade-offs

[Risk: Tool descriptions add tokens to system prompt]
Tier 1 adds 12 tool descriptions. Mitigation: only register tools with enabled permissions. Default empty permissions means no tools register unless explicitly enabled.

[Risk: Patch fuzzy matching may match unintended code]
Start with 9 conservative strategies. If false positives occur, tighten matching. Document in the tool description that the LLM should provide the exact string to replace.

[Risk: Terminal allows arbitrary command execution]
Gated by `process:spawn` + `filesystem:exec` permissions. Enforce max command length (4096 chars). Execute via `sh -c` (not raw command). Timeout enforced via `src/sandbox/timeoutHandler.js`.

[Risk: Todo file race conditions between sessions]
File permissions prevent concurrent write corruption. Document as known limitation; fix in follow-up with file locking.

[Risk: Skill registry initialization order]
`skills_list` and `skill_view` depend on `SkillRegistry`. `buildToolConfig` should receive the registry instance as a parameter (not resolve internally) for testability.

## Open Questions
1. Should `buildToolConfig` receive the registry as a parameter? **Decision: Yes — for testability.**
2. Default permission set? **Decision: Empty array — safe, no tools register until explicitly enabled.**

## Migration Plan

### Deployment Steps
1. Add `sandbox.permissions` and `sandbox.maxReadSize` to `config.yaml` (new fields, backward-compatible with defaults)
2. Run `npm run lint && npm run test` to verify all tool tests pass
3. No breaking changes to existing functionality — existing agents with no tools continue to work
4. Users can enable tools by adding permissions to `config.yaml`:
   ```yaml
   sandbox:
     permissions:
       - filesystem:read
       - filesystem:write
       - filesystem:exec
       - process:spawn
   ```

### Rollback
If tools cause issues, remove the `sandbox.permissions` entries from `config.yaml` and restart. Tools require an explicit permission to register, so removing permissions is sufficient to disable them.
