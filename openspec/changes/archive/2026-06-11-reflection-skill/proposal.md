## Why

The agent has no sense of its own relationship with the user across sessions. Ephemeral memory captures discrete facts and clarifications, but nothing captures the qualitative experience of working together — the energy, mood, rhythm, or trust level of recent interactions. Without this, each session starts from zero, losing the subtle continuity that makes collaborating with the same person over time feel cohesive rather than repeated.

## What Changes

- Introduce a new built-in skill named **Reflection** that reads Markdown session files from `memory/sessions/`
- Filter out sessions older than the last 7 days
- Sort sessions by `startedAt` in descending order (most recent first)
- Generate a narrative summary of interactions capturing the qualitative "vibe" and energy of each session rather than granular details
- Store the result as `memory/context/reflection.md`, made active on the next session via the existing `context.js` loader
- The reflection represents the agent's current opinion of how the work relationship has been evolving, distinct from factual profile or ephemeral memory entries

## Capabilities

### New Capabilities

- `reflection-summary`: Reads recent session files, filters by 7-day window, and generates a narrative summary of interaction quality and energy stored as a context file

### Modified Capabilities

- None

## Impact

- **New file**: `skills/reflection/SKILL.md` — the skill definition
- **New file (generated)**: `memory/context/reflection.md` — written on each invocation
- **Modified**: `src/memory/context.js` — loads and includes `reflection.md` alongside other context files automatically (or the skill writes in a format already consumed by the context loader)
- **Reads**: `memory/sessions/*.md` — session files with frontmatter (`startedAt`, `endedAt`) and JSON message arrays
