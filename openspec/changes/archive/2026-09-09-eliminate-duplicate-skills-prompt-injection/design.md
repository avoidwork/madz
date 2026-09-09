## Context

The orchestrator in `src/agent/deepAgents.js` calls `buildSkillsMapping()` to inject a "### SKILL ASSIGNMENTS" section into the system prompt. deepagents' `SkillsMiddleware.wrapModelCall()` independently injects a "## Skills System" section. Both list the same skills, wasting ~50 lines of prompt context.

`getSkillPathsForAgent()` returns absolute paths (e.g., `/home/jason/Projects/madz/skills/audit-code/`) while `getSkillPaths()` returns relative paths (e.g., `skills/audit-code/`). The `LocalShellBackend` resolves relative paths against `cwd`, so both work today, but the inconsistency is fragile.

## Goals / Non-Goals

**Goals:**
- Remove duplicate skills listing from the orchestrator system prompt
- Make `getSkillPathsForAgent()` return relative paths consistent with `getSkillPaths()`

**Non-Goals:**
- No changes to how skills are discovered, validated, or assigned to subagents
- No changes to deepagents' `SkillsMiddleware` behavior

## Decisions

1. **Remove `buildSkillsMapping()` entirely** — The function is only called from `createDeepAgentsOrchestrator()`. deepagents' `SkillsMiddleware` already handles skills prompt injection. The orchestrator routes tasks via subagent descriptions and the `task` tool, not via a static skills mapping section.

2. **Use `#relativePath()` in `getSkillPathsForAgent()`** — The private method already exists and is used by `getSkillPaths()`. Reusing it ensures consistency and centralizes the path-relative-to-cwd logic.

## Risks / Trade-offs

- If deepagents' `SkillsMiddleware` fails to load skills (backend error, permission issue), the prompt will have no skills section. Previously the custom mapping would still appear. This is acceptable — the middleware handles its own errors and the orchestrator still has subagent descriptions for routing.
