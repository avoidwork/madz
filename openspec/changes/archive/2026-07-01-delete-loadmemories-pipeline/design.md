## Context

The madz application has two parallel memory loading pipelines that load the same data from `memory/context/` and append it to the system prompt:
- `loadContext` (`src/memory/context.js`) — loads profile, clarifications, reflection, and ephemeral entries. Already wired into the system prompt via `prompts.js`.
- `loadMemories` (`src/memory/loadMemories.js`) — loads the same memory files, formats them, and is called in `index.js:244` inside `callProvider()`.

This causes the LLM to receive duplicate memory data. `loadContext` is the superior pipeline with profile prioritization, ephemeral limiting, and persistent-first ordering.

## Goals / Non-Goals

**Goals:**
- Remove `loadMemories` pipeline entirely
- Remove all references to `loadMemories`, `formatMemoriesForPrompt`, and `parseEntryFile`
- Remove `memory.entriesDir` from config
- Ensure `loadContext` remains the sole memory loading path

**Non-Goals:**
- Modifying `loadContext` behavior
- Adding new memory loading capabilities
- Migrating data (no data loss risk)

## Decisions

1. **Delete `loadMemories.js` entirely** — No migration needed since `loadContext` already handles all the same data.
2. **Delete `tests/unit/memories.test.js`** — All tests are for `loadMemories` functions. `loadContext` is already tested in `tests/unit/context.test.js` and `tests/unit/prompts.test.js`.
3. **Remove `memory.entriesDir` from config** — Only used by `loadMemories`, no other code references it.

## Risks / Trade-offs

- [Risk] Accidentally removing a reference that's still in use → Mitigation: grep for all references before deleting
- [Risk] Config removal breaks something → Mitigation: verify `entriesDir` is only used in `loadMemories.js`
- [Trade-off] Losing `parseEntryFile` utility — but it's only used by `loadMemories`, so no replacement needed