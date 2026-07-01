## MODIFIED Requirements

### Requirement: User-Provided Context Storage
The system SHALL allow users to write free-form context notes to `memory/` which are appended to the LLM context window at the start of each interaction. The system SHALL use a single consolidated `loadContext` function to load all memory files (profile.md, ephemeral memories, and context files) in a unified pipeline, returning structured entries for prompt formatting.

#### Scenario: System loads all memory files via consolidated function
- **WHEN** a new conversation message is sent
- **THEN** the system calls `loadContext()` which loads profile.md, ephemeral memories, and context files in a single pipeline and returns structured entries

#### Scenario: Consolidated loader preserves structured entry format
- **WHEN** `loadContext()` is called
- **THEN** it returns an array of structured entries `{key, metadata, memory}` suitable for prompt formatting

#### Scenario: Memory files are sorted by recency
- **WHEN** `loadContext()` loads memory files
- **THEN** entries are sorted by date with the most recent first