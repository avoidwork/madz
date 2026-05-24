## ADDED Requirements

### Requirement: Conversation history persistence
The system SHALL persist the complete conversation history as a markdown file in `memory/conversations/` with ISO timestamp filenames.

#### Scenario: Message appended to conversation
- **WHEN** a user message or LLM response is exchanged
- **THEN** the entry is appended to the current conversation markdown file with metadata header (role, timestamp, model, tokens)

#### Scenario: New conversation created
- **WHEN** the user initiates a new conversation (e.g., `/new`)
- **THEN** the system creates a new timestamped markdown file under `memory/conversations/` and switches to it

#### Scenario: Conversation list listing
- **WHEN** the user requests the list of conversation files
- **THEN** the system displays all files in `memory/conversations/` sorted by most recent

### Requirement: Tool output logging
The system SHALL log all tool/skill invocations and their outputs as markdown files in `memory/tools/`.

#### Scenario: Tool invocation logged
- **WHEN** a registered skill is invoked
- **THEN** the system writes a markdown file under `memory/tools/` with the skill name, input arguments, execution result, duration, and token metadata

#### Scenario: Tool output stored in conversation context
- **WHEN** a skill execution produces output that is relevant to the conversation
- **THEN** the system appends a summary of the tool output to the active conversation markdown file

### Requirement: User-supplied context management
The system SHALL allow users to define and reference external context stored as markdown files in `memory/context/`.

#### Scenario: Context file created
- **WHEN** a user writes a markdown file to `memory/context/` with a defined name
- **THEN** the system indexes the file and makes it referenceable via `/context <name>`

#### Scenario: Context injected into conversation
- **WHEN** a message includes a reference to a context file
- **THEN** the system reads the context file and prepends its content to the prompt sent to the LLM

### Requirement: SOUL.md personality definition
The system SHALL load `SOUL.md` from the project root on startup and use it to establish the assistant's tone, expertise domains, behavioral constraints, and default decision patterns.

#### Scenario: SOUL.md loaded at startup
- **WHEN** the application starts and `SOUL.md` exists
- **THEN** the system loads the file and injects its content into the system prompt for all LLM interactions

#### Scenario: SOUL.md edited externally
- **WHEN** the user edits `SOUL.md` while the application is running
- **THEN** the system detects the change and reloads the new personality on the next `/soul reload` command

#### Scenario: Missing SOUL.md with safe defaults
- **WHEN** `SOUL.md` does not exist at startup
- **THEN** the system uses built-in safe defaults for persona and logs a warning

### Requirement: Memory retention and cleanup
The system SHALL enforce configurable retention policies for memory files to prevent unbounded growth.

#### Scenario: Retention-based cleanup
- **WHEN** the configured retention period (`memory.retention.days` in `config.yaml`) has passed for a memory file
- **THEN** the cleanup job purges the expired file on the next scheduled run

#### Scenario: Maximum file count enforcement
- **WHEN** the number of memory files exceeds `memory.retention.maxFiles`
- **THEN** the system removes the oldest files until the count is within the limit
