## Why

Deep Agents' `SkillsMiddleware` injects a hardcoded prompt that instructs the agent to `read_file` the SKILL.md path when a skill matches. This competes with the `skill` tool added in the `skill-tool` change — the agent was actively told to `read_file` instead of calling the `skill` tool, so the tool was never used. The prompt must direct the agent to the `skill` tool.

## What Changes

- Replace deepagents' auto-created `SkillsMiddleware` with a madz-owned middleware that injects a prompt directing the agent to the `skill` tool, not `read_file`.
- The replacement is named `SkillsMiddleware` so it displaces the library default via same-name merge.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `skill-tool`: Add a requirement that the skill-loading prompt directs the agent to the `skill` tool rather than `read_file`.

## Impact

- `src/agent/skillsMiddleware.js` — new replacement middleware.
- `src/agent/deepAgents.js` — register the replacement middleware in the orchestrator's middleware array.
- `src/skills/registry.js` — `getCatalog()` consumed by the middleware (no change).

## Non-goals

- No change to the `skill` tool itself.
- No per-agent skill filtering for subagents (out of scope).
