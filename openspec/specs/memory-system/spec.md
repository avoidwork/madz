## Purpose

Defines the memory system's capabilities for persisting conversations, storing tool outputs, managing user-provided context, indexing memory entries, and enforcing retention policies.
## Requirements
### Requirement: Conversation Persistence
The system SHALL persist every conversation exchange (user input, LLM output, tool results) as a timestamped markdown file in the `memory/` directory. YAML frontmatter metadata (timestamp, provider, model, and any additional fields) SHALL be properly escaped to ensure valid YAML output when values contain special characters such as double quotes, backslashes, or newlines.

#### Scenario: System persists a conversation message
- **WHEN** the user sends a message or the LLM generates a response
- **THEN** a new markdown file is written to `memory/` containing the exchange with YAML frontmatter for metadata (timestamp, provider, model)

#### Scenario: System reads conversation history from memory
- **WHEN** the user reopens the TUI after exiting
- **THEN** the system loads the latest conversation file from `memory/` and displays the history in the conversation panel

#### Scenario: Frontmatter with special characters is valid YAML
- **WHEN** a title or frontmatter value contains double quotes, backslashes, or newlines
- **THEN** the generated YAML frontmatter is properly escaped and can be parsed without errors

### Requirement: Tool Output and Execution Log Storage
The system SHALL store tool execution results and error logs as separate markdown files in `memory/` with cross-reference links to the parent conversation file.

#### Scenario: System stores a tool output
- **WHEN** a registered skill or tool executes
- **THEN** the result is written to a timestamped markdown file in `memory/tools/` with a reference link back to the conversation

#### Scenario: System stores an execution error
- **WHEN** a tool execution throws an unhandled error
- **THEN** the error (stack trace reduced) is written to `memory/errors/` as a markdown file

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

### Requirement: Memory Indexing
The system SHALL maintain an index file (`memory/_index.md`) with YAML frontmatter that records the path, title, and timestamp of persisted memory entries for fast retrieval.

#### Scenario: Index is updated on new entry
- **WHEN** a new memory markdown file is created
- **THEN** the system appends an entry to `memory/_index.md` with the file path, timestamp, and a short title

#### Scenario: System searches memory by index
- **WHEN** the user runs `:memory search <query>` in the TUI
- **THEN** the system queries `memory/_index.md` frontmatter and opens the matching file

### Requirement: Memory Retention Policy
The system SHALL enforce a configurable retention policy that automatically purges memory files older than a specified duration or beyond a maximum entry count.

#### Scenario: Old memory files are purged
- **WHEN** a memory file exceeds the configured `retention.days` from `config.yaml`
- **THEN** the system removes the file during the next maintenance cycle

