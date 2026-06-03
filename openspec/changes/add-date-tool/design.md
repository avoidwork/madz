## Context

The project uses LangChain `tool()` wrappers for all assistant tools, defined in `src/tools/`. Each tool follows a consistent pattern:
1. A `toolNameImpl(input, options)` function that returns a JSON string result.
2. A LangChain `tool()` export with `name`, `description`, and `schema` properties.
3. A `createToolNameTool(options)` factory that binds runtime options via closure.
4. Registration in `src/tools/index.js` via `TOOL_PERMISSIONS` and `TOOL_FACTORIES` maps.

Tools with no permissions (like `clarify`, `execute_code`, `sampling`) use an empty `requiredPerms` array and always register when available.

## Decisions

1. **Tool name: `date`**
   - Short, obvious, and consistent with other utility tools.

2. **Return format: ISO 8601**
   - `new Date().toISOString()` produces `YYYY-MM-DDTHH:mm:ss.sssZ` — the standard format for machines and humans in Node.js.

3. **No input parameters**
   - The tool always returns the current date/time. A schema with no required fields is sufficient.

4. **Zero permissions**
   - Registered like `clarify` and `sampling` — always available, no sandbox permissions required.

5. **No state, no I/O**
   - Pure time query. No file reads, no network calls, no persistence. Minimal overhead.

## Architecture

```
src/tools/date.js
  ├── dateImpl(input, options) → string   // returns JSON envelope
  ├── export const date = tool(dateImpl, {…})  // LangChain wrapper
  └── export function createDateTool(options) → Tool  // factory

src/tools/index.js
  ├── import { createDateTool } from "./date.js"
  ├── TOOL_PERMISSIONS.date = []
  ├── TOOL_FACTORIES.date = createDateTool
  └── default: case in buildToolConfig() — no extra gating needed
```

## Risks / Trade-offs

[Risk] The tool always returns UTC (via `toISOString()`). → **Mitigation**: ISO 8601 with `Z` suffix clearly indicates UTC. LLMs understand this format and can convert if needed.
[Risk] Redundant with `console.log(new Date())` in code execution. → **Mitigation**: The tool is for natural conversation; code execution is for programming tasks. They serve different interaction modes.
