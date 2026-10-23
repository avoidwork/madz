## Context

Deep Agents' `createSkillsMiddleware` injects a hardcoded `SKILLS_SYSTEM_PROMPT` that tells the agent to `read_file` the SKILL.md path when a skill matches. The `skill-tool` change added a `skill` tool that loads the body deterministically, but the library's prompt still steers the agent toward `read_file`, so the tool was never used.

## Goals / Non-Goals

**Goals:**
- Replace the library's `SkillsMiddleware` prompt so it directs the agent to the `skill` tool.
- Preserve skill discovery (name + description in the system prompt) and progressive disclosure.

**Non-Goals:**
- No change to the `skill` tool.
- No per-agent skill filtering for subagents.

## Decisions

- **Replacement middleware named `SkillsMiddleware`** — deepagents' `mergeMiddlewareStack` merges by name (`matchingMiddleware(customMiddleware, defaultMiddlewareNames)` → `mergeMiddleware$1` replaces by name). A middleware named `SkillsMiddleware` in madz's `middleware` array displaces the library's auto-created one. This is the same mechanism the eviction-ceiling middleware uses.
- **Use madz's `SkillRegistry`** — the middleware loads the skill catalog via `registry.getCatalog()` (already discovered) instead of re-reading the backend. This avoids duplicate discovery and keeps the list in sync with the `skill` tool.
- **Corrected prompt** — the injected prompt says "Use the `skill` tool with the skill's name" and shows `skill({ name: "..." })`, replacing the library's "Use `read_file` on the path shown in the skill list above".

## Risks / Trade-offs

- [The library's `formatSkillsList` appends "→ Read `<path>` for full instructions" to each skill] → The replacement `formatSkillsList` omits that line, pointing at the `skill` tool instead.
- [Subagents with their own skills still get the library's `SkillsMiddleware`] → Out of scope; the orchestrator is the primary path.
