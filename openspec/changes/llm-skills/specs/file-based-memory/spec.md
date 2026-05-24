## ADDED Requirements

### Requirement: Skill Context Injection for Memory
The memory system SHALL support a new category of context entries called "skill context." When a skill is active, the skill's instructions are captured as a skill context entry and included alongside the conversation history when reading the session file for context injection. Skill context entries are prefixed with `### Skill: <name> Context` in the markdown session file.

#### Scenario: Skill context is included in memory injection
- **WHEN** a skill is active and the system reads the session file for context
- **THEN** the system includes the skill's instructions (as `### Skill: <name> Context`) in the injected context

#### Scenario: Skill context is removed when skill completes
- **WHEN** a skill completes or is aborted
- **THEN** the system no longer includes that skill's context in subsequent memory injection reads

### Requirement: Skill Execution History Tracking
The memory system SHALL track skill execution history by creating a dedicated section in each session memory file called `## Skill Executions` that records a list of skill IDs executed during the session along with their status (`completed`, `failed`, `aborted`) and timestamps.

#### Scenario: Skill execution is logged in session file
- **WHEN** a skill completes during a session
- **THEN** the system appends an entry to the `## Skill Executions` section with skill ID, start time, end time, and status

### Requirement: Skill Resource Path Resolution
The memory system SHALL resolve skill resource paths when reading from session files. If a skill references external resources (e.g., `## Resources` in the skill instructions), the system MUST resolve these paths relative to the skill's directory and serve the content as part of the session context injection.

#### Scenario: Skill resource content is included in session context
- **WHEN** a skill's instructions reference a resource file in the `resources` frontmatter
- **THEN** the system resolves and includes the resource content as a markdown block in the injected context
