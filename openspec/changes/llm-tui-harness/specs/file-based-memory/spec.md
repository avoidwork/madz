## ADDED Requirements

### Requirement: Session Memory Files
The system SHALL persist all conversation history, tool outputs, user-supplied context, and execution logs as plain-text markdown files in a configurable memory directory. Each session SHALL produce at least one markdown document with a consistent naming convention (`<session-id>.md` or `<date>-<session-id>.md`). The system MUST append new entries to existing session files rather than rewriting entire documents.

#### Scenario: New session creates a memory file
- **WHEN** the application starts a new session
- **THEN** the system creates a markdown file named after the session ID in the configured memory directory

#### Scenario: User message is appended to session file
- **WHEN** the user sends a message during a session
- **THEN** the system appends the message as a `### User` heading with the timestamp and text content to the session file

#### Scenario: Assistant response is appended to session file
- **WHEN** the assistant generates a response during a session
- **THEN** the system appends the response as a `### Assistant` heading with the timestamp and response text to the session file

#### Scenario: Tool output is embedded in session file
- **WHEN** a tool executes during a session
- **THEN** the system appends a `### Tool: <name>` heading with the input, output (as a markdown code block), and duration to the session file

### Requirement: Memory Injection for LLM Context
The system SHALL read active session memory files and recent external memory files and inject their contents as structured context into the LLM prompt. Memory injection MUST be bounded by a configurable token or line limit. The system MUST provide a command (`/add-context`) for users to manually append free-form context to the active session memory that will be injected on the next prompt.

#### Scenario: Session files are injected into prompt
- **WHEN** the system prepares to send a prompt to the LLM during a session
- **THEN** the system reads the active session memory file and includes conversation history in the LLM prompt context

#### Scenario: User adds manual context
- **WHEN** the user invokes `/add-context "Some background info"` during a session
- **THEN** the system appends the background info to the active session file and it is included in the next LLM prompt

#### Scenario: Memory injection respects configured limit
- **WHEN** a session file exceeds the configured maximum line count
- **THEN** the system truncates the oldest entries to fit within the limit while retaining the most recent conversation

### Requirement: Cross-Session Recall
The system SHALL make all past session memory files discoverable and queryable by session ID, date, or glob pattern. The system MUST support a command (`/<tool name> <args>`) to display the contents of a specific past session or a summary view without loading the full file into the LLM context.

#### Scenario: User views a past session summary
- **WHEN** the user invokes a command to list past sessions
- **THEN** the system returns a list of available sessions with their dates, IDs, and line counts

#### Scenario: User reads a past session file
- **WHEN** the user requests the full contents of a past session file
- **THEN** the system displays the markdown content of that session file

### Requirement: Memory File Integrity
The system MUST maintain memory files in valid markdown format at all times. Concurrent writes during a session SHALL be serialized to prevent file corruption. The system SHALL support automatic backup of memory files before truncation or archival. Backups MUST be placed in a `memory/.backups/` subdirectory.

#### Scenario: Memory file remains valid markdown after append
- **WHEN** a session entry is appended to a memory file
- **THEN** the resulting file remains syntactically valid markdown with proper heading structure

#### Scenario: Memory backup is created before truncation
- **WHEN** the system truncates a session file due to line-limit overflow
- **THEN** a backup copy of the original file content is saved to `memory/.backups/` before modification

### Requirement: Version Control Readiness
Memory files and SOUL.md SHALL be formatted (with trailing newlines, consistent heading structure) such that they can be directly committed to a git repository. The system SHALL support a command (`/commit-memory`) that runs `git add` and `git commit` on the memory directory and configuration files using a conventional commit message format.

#### Scenario: Memory directory is git-ready
- **WHEN** the memory directory is inspected after a session
- **THEN** all markdown files end with a trailing newline and have consistent `---` frontmatter or heading structure

#### Scenario: User commits session history
- **WHEN** the user invokes `/commit-memory` during a session
- **THEN** the system executes `git add` and `git commit` with a conventional commit message reflecting the session activity
