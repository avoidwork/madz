## ADDED Requirements

### Requirement: loadContext is the sole memory loading mechanism
The system SHALL use only `loadContext` from `src/memory/context.js` for loading memory data (profile, clarifications, reflection, and ephemeral entries) into the system prompt.

#### Scenario: loadContext loads all memory
- **WHEN** the application loads the system prompt
- **THEN** `loadContext` is used to load all memory data
- **AND** no other memory loading function is called

## REMOVED Requirements

### Requirement: loadMemories pipeline
The `loadMemories` function and its associated utilities (`formatMemoriesForPrompt`, `parseEntryFile`) SHALL be removed from the codebase. Memory loading is now handled exclusively by `loadContext` in `src/memory/context.js`.

**Reason:** Duplicate memory loading pipeline causing the LLM to receive the same memory data twice in the system prompt.

**Migration:** No migration needed — `loadContext` already handles all memory loading with superior features (profile prioritization, ephemeral limiting, persistent-first ordering).

#### Scenario: loadMemories no longer exists
- **WHEN** the application loads the system prompt
- **THEN** only `loadContext` is used to load memory data (profile, clarifications, reflection, ephemeral entries)
- **AND** `loadMemories` is not called anywhere in the codebase

#### Scenario: memory.entriesDir removed from config
- **WHEN** the application loads configuration
- **THEN** `memory.entriesDir` is not present in the config schema or usage
- **AND** `memory.contextDir` remains as the only memory directory configuration