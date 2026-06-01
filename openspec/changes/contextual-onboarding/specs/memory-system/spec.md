## MODIFIED Requirements

### Requirement: User-Provided Context Storage
The system SHALL allow users to write free-form context notes to `memory/` which are appended to the LLM context window at the start of each interaction. Additionally, the system SHALL persist the contextual profile as a markdown file at `memory/profile/profile.md` and include it in the context prompt alongside user-provided notes.

#### Scenario: User adds a context note
- **WHEN** the user writes a context note via the TUI (`:context add <text>`)
- **THEN** a markdown file is created in `memory/context/` and appended to the conversation context prefix

#### Scenario: System loads context before interaction
- **WHEN** a new conversation message is sent
- **THEN** the system reads all recent context files from `memory/context/` and prepends them to the LLM prompt

### Requirement: Memory Indexing
The system SHALL maintain an index file (`memory/_index.md`) with YAML frontmatter that records the path, title, and timestamp of persisted memory entries for fast retrieval. Additionally, profile files in `memory/profile/` SHALL be included in the index.

#### Scenario: Index is updated on new entry
- **WHEN** a new memory markdown file is created
- **THEN** the system appends an entry to `memory/_index.md` with the file path, timestamp, and a short title

#### Scenario: System searches memory by index
- **WHEN** the user runs `:memory search <query>` in the TUI
- **THEN** the system queries `memory/_index.md` frontmatter and opens the matching file
