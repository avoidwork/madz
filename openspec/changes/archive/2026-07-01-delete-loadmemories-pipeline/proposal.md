## Why

There are two parallel memory loading pipelines that load the same data from `memory/context/` and append it to the system prompt: `loadContext` (in `src/memory/context.js`) and `loadMemories` (in `src/memory/loadMemories.js`). This causes the LLM to receive duplicate memory data. `loadContext` is the superior pipeline with profile prioritization, ephemeral limiting, and persistent-first ordering. `loadMemories` adds nothing and is dead weight.

## What Changes

- Delete `src/memory/loadMemories.js` entirely
- Delete `tests/unit/memories.test.js` entirely (all tests are for `loadMemories`)
- Remove `loadMemories` and `formatMemoriesForPrompt` imports from `index.js`
- Remove `loadMemories()` and `formatMemoriesForPrompt()` calls from `callProvider()` in `index.js`
- Remove `${memoryText ? ...}` from the `callPrompt` template string in `index.js`
- Remove `loadMemories` and `formatMemoriesForPrompt` from module exports in `index.js`
- Remove `loadMemories`, `formatMemoriesForPrompt`, `parseEntryFile` exports from `src/memory/index.js`
- Remove `memory.entriesDir` from config schema and usage

## Capabilities

### New Capabilities
<!-- None — this is a removal/cleanup task -->

### Modified Capabilities
<!-- None — no spec-level behavior changes, only implementation removal -->

## Impact

- **Deleted:** `src/memory/loadMemories.js`, `tests/unit/memories.test.js`
- **Modified:** `index.js` (3 locations), `src/memory/index.js` (1 location), `config.yaml`, `src/config/schemas.js`
- **Unchanged:** `src/memory/context.js` (loadContext stays), `src/memory/prompts.js` (already uses loadContext)
- **Config:** `memory.entriesDir` removed from schema and usage
- **Net effect:** One less pipeline, one less file to maintain, no duplicate memory data in system prompts