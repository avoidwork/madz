## Context

The madz project uses a tool-based architecture where each tool is a LangChain tool instance created by a factory function. Tools are registered in `src/tools/index.js` via two maps: `TOOL_PERMISSIONS` (name to required permission scopes) and `TOOL_FACTORIES` (name to factory function). The `buildToolConfig` function iterates over these maps, checks permissions, and instantiates tools with runtime options.

Currently, there is no dedicated tool for discovering and loading AGENTS.md files. Agents must rely on implicit context or manually use `readFile` with a known path. This creates a gap in the agent's ability to adapt to project-specific guidance.

## Goals / Non-Goals

**Goals:**
- Provide a simple, discoverable tool for finding and reading AGENTS.md files
- Follow the existing minimal tool pattern (like `date.js`)
- Reuse existing path validation infrastructure for safety
- Require no sandbox permissions (always available)
- Complete silently when AGENTS.md is not found

**Non-Goals:**
- Automatic injection of AGENTS.md into system prompt
- Recursive directory scanning for multiple AGENTS.md files
- Caching or performance optimization
- Parsing or interpreting AGENTS.md content
- Modifying existing tools to auto-load AGENTS.md

## Decisions

### Decision 1: Silent failure on missing file
**Choice:** Return empty string when AGENTS.md is not found, no error message.
**Rationale:** The tool is a discovery mechanism, not a requirement. Agents can check the result to determine presence. Error messages would create noise in the agent's workflow when AGENTS.md is simply not present in a given directory.
**Alternatives considered:**
- Return an error message — rejected because it creates noise for a non-problem
- Return null — rejected because the tool returns strings consistently

### Decision 2: No permissions required
**Choice:** Register with empty permission array `[]`, like `date` and `clarify`.
**Rationale:** Path safety is handled by `validatePath` and `checkFileLimit` from `src/tools/common.js`. The tool cannot read outside allowed paths regardless of permissions. Keeping it permission-free ensures it's always available.
**Alternatives considered:**
- Require `filesystem:read` — rejected because path validation already prevents unauthorized access
- Require a new `agents:read` permission — rejected because it adds unnecessary complexity

### Decision 3: Optional path parameter
**Choice:** Accept optional `path` string parameter, defaulting to `process.cwd()`.
**Rationale:** The common case is scanning the current working directory. Sub-agents working in other directories need the ability to specify a path. Making it optional keeps the API simple for the common case.
**Alternatives considered:**
- Required path parameter — rejected because it adds friction for the common case
- No path parameter, always use CWD — rejected because sub-agents need path control

### Decision 4: Reuse existing validation infrastructure
**Choice:** Use `validatePath` and `checkFileLimit` from `src/tools/common.js`.
**Rationale:** These utilities already handle path traversal prevention, symlink resolution, and size limits. Reusing them ensures consistent security across all tools.
**Alternatives considered:**
- Custom path validation — rejected because it duplicates existing, tested code

## Risks / Trade-offs

### Risk: Large AGENTS.md files
**Mitigation:** `checkFileLimit` enforces the configured max read size (default 1mb). Files exceeding this limit will be rejected with a clear error message.

### Risk: Path traversal via crafted path parameter
**Mitigation:** `validatePath` resolves the path against allowed paths and rejects any traversal attempts. This is the same protection used by `readFile`, `writeFile`, and other file tools.

### Trade-off: Simple vs. powerful
The tool is intentionally minimal. More complex features (recursive scanning, caching, format parsing) can be added later if needed. Starting simple reduces implementation risk and makes the tool easier to test and maintain.

### Trade-off: Raw string return
The tool returns raw file content as a string. The agent is responsible for parsing and incorporating the content. This keeps the tool composable and avoids making assumptions about how AGENTS.md should be used.

## Open Questions

None at this time. The design is straightforward and follows established patterns in the codebase.