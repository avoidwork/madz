## Why

Deep Agents loads skills via progressive disclosure: at startup only each skill's name and description are injected into the system prompt, and the agent is expected to read the full SKILL.md body itself via `read_file` when a task matches. In practice models routinely fail this chain — they guess the skill exists, try to execute it without reading the body, or never read it because the description was too vague. madz already has the primitives (`SkillRegistry.getSkillBody(name)`, `SkillRegistry.get(name)`) but no tool exposes them.

## What Changes

- Add a `skill` orchestrator tool that returns the full SKILL.md body for a named skill, plus a sampled inventory of its supporting files.
- Register the `skill` tool as universal — available to the orchestrator and all 12 subagents.
- Remove the "Skills are in your skills/ directory." stopgap message from the TUI project notifications.

## Capabilities

### New Capabilities
- `skill-tool`: A tool that deterministically loads a skill's SKILL.md body and supporting-file inventory on demand, available to the orchestrator and every subagent.

### Modified Capabilities
- None.

## Impact

- `src/tools/skills/index.js` — add the `skill` tool alongside `createSkill`.
- `src/tools/index.js` — register `skill` in `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, and `TOOLS`.
- `src/tui/app.js` — remove the stopgap message from two `pendingSilentMessageRef` strings.
- `src/skills/registry.js` — `getSkillBody` and `get` are the consumed primitives (no change).

## Non-goals

- No script execution — the tool loads instructions and file inventory; the model does the work.
- No permission system — read-only, gated by `filesystem:read` only.
