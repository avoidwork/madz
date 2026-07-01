## Context

The `loadContext` function in `src/memory/context.js` loads all `.md` files from the memory directory and concatenates them into a context string. Currently, there is no distinction between persistent memories (profile, long-term memories) and ephemeral memories (short-lived, temporary context). All files are processed in timestamp order, which means ephemeral files can appear anywhere in the context output.

The `loadSystemPrompt` function in `src/memory/prompts.js` loads `SYSTEM_PROMPT.md` but does not incorporate the context from `loadContext`. This means the LLM's system prompt doesn't include the current memory state.

## Goals / Non-Goals

**Goals:**
- Ensure `profile.md` is always loaded first in `loadContext`
- Filter ephemeral files from the main processing loop
- Load ephemeral memories as a final step with a configurable limit
- Wire `loadContext` output into `loadSystemPrompt` so context is appended to `SYSTEM_PROMPT.md`

**Non-Goals:**
- Changes to how ephemeral memories are created, stored, or expired
- Changes to the memory retention system
- Changes to the scheduler or TUI
- Changes to how `SYSTEM_PROMPT.md` is initially structured

## Decisions

1. **Ephemeral files identified by name prefix `ephemeral`**
   - Rationale: Simple, consistent with existing naming conventions. No database changes needed.
   - Alternative: Use a metadata field or separate directory. Rejected because it would require schema changes.

2. **Ephemeral limit defaults to 5**
   - Rationale: Provides recent temporary context without overwhelming the system prompt. Configurable for power users.
   - Alternative: No limit (load all). Rejected because it could dilute persistent context.

3. **Ephemeral memories sorted newest-first**
   - Rationale: Recent temporary context is more relevant than older ephemeral data.
   - Alternative: Same sort order as persistent context (oldest-first). Rejected because recency matters more for ephemeral data.

4. **Context appended to `SYSTEM_PROMPT.md`, not prepended**
   - Rationale: Profile.md (loaded first) appears at the top of the context section, maintaining priority order.
   - Alternative: Prepend context. Rejected because it would push profile.md deeper in the prompt.

5. **Config option `memory.ephemeralLimit` in `config.yaml`**
   - Rationale: Centralized configuration, consistent with existing config patterns.
   - Alternative: Hardcoded default. Rejected because users may want to adjust based on their memory volume.

## Risks / Trade-offs

- [Risk] Ephemeral filtering could exclude legitimate non-ephemeral files if naming convention changes → Mitigation: Use configurable prefix or metadata field in future
- [Risk] Loading ephemeral memories adds I/O overhead → Mitigation: Limited to configurable number (default 5), negligible impact
- [Risk] Context appended to `SYSTEM_PROMPT.md` could make the file very large → Mitigation: Ephemeral limit controls volume, persistent context is bounded by retention

## Open Questions

- None at this time.