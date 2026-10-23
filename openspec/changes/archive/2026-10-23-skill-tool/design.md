## Context

madz uses Deep Agents' progressive-disclosure skill loading: at startup only each skill's name and description are injected into the system prompt, and the agent is expected to read the full SKILL.md body itself via `read_file` when a task matches. In practice models routinely fail this chain. The `SkillRegistry` already exposes `getSkillBody(name)` (tier-2 body) and `get(name)` (metadata including `_directory` and `scripts`), but no tool surfaces them.

## Goals / Non-Goals

**Goals:**
- Add a `skill` tool that returns a skill's SKILL.md body plus a sampled inventory of its supporting files.
- Make the tool universal — available to the orchestrator and all 12 subagents.
- Remove the "Skills are in your skills/ directory." stopgap message from the TUI project notifications.

**Non-Goals:**
- No script execution — the tool loads instructions and file inventory; the model does the work.
- No permission system — read-only, gated by `filesystem:read` only.

## Decisions

- **Tool name `skill`** — matches opencode's naming and is short. Takes `{ name: string }`.
- **Return shape `{ name, body, directory, files[] }`** — `body` from `getSkillBody(name)`, `directory` from `metadata._directory`, `files` enumerated from the skill directory (scripts/, references/, assets/), excluding SKILL.md, capped at ~10.
- **Universal registration** — register in `ORCHESTRATOR_TOOLS`, `TOOL_PERMISSIONS` (`filesystem:read`), `TOOLS`, and `TOOL_CLASSIFICATIONS` for all 12 agent types so `getToolsForAgentTypes` surfaces it to every subagent.
- **No permission system** — read-only tool; no per-skill ask/deny. Keeps scope minimal.

## Risks / Trade-offs

- [Missing a classification silently drops the tool for that subagent] → Register `skill` for all 12 agent types explicitly; verify via `getToolsForAgentTypes`.
- [Large supporting-file trees bloat context] → Cap the `files` array at ~10 entries.
- [Skill with no body path returns null] → Return a clear error message rather than an empty body.
