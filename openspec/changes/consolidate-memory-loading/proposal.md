## Why

The madz project maintains two parallel memory loading pipelines — `loadContext` (in `src/memory/context.js`) and `loadMemories` (in `src/memory/loadMemories.js`). This duplication creates maintenance overhead and confusion about which pipeline handles what. Consolidating into a single `loadContext` function eliminates this redundancy and simplifies the memory loading architecture.

## What Changes

- Delete `src/memory/loadMemories.js` entirely
- Move structured memory loading logic from `loadMemories` into `loadContext` in `src/memory/context.js`
- Move helper functions (`parseEntryFile`, `formatMemoriesForPrompt`, `getMemoryContext`) into `context.js`
- Update `src/memory/index.js` to only export from the consolidated `loadContext`
- Update `index.js` call sites to use the consolidated function
- Migrate tests from `tests/unit/memories.test.js` to test the consolidated approach

## Capabilities

### New Capabilities
<!-- None — this is a refactoring, not a new feature -->

### Modified Capabilities
- `memory-system`: The memory loading pipeline is consolidated from two functions into one. The `loadContext` function will now handle all memory file loading (profile, ephemeral, context files) and return structured entries instead of a plain string.

## Impact

- **Affected code:** `src/memory/loadMemories.js` (delete), `src/memory/context.js` (modify), `src/memory/index.js` (modify), `index.js` (modify)
- **Tests:** `tests/unit/memories.test.js` (migrate)
- **No API changes:** The external behavior of memory loading remains the same, only the internal implementation changes
- **No new dependencies**