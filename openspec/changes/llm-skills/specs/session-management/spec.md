## ADDED Requirements

### Requirement: Skill State
The session state machine SHALL extend its state set with skill-related states: `skill_active`, `skill_paused`, and `skill_completed`. These states are scoped under the session's primary state. When a skill is activated, the session transitions to `skill_active` (from `processing`). When a skill execution is paused (e.g., for destructive approval), the state becomes `skill_paused`. When the skill completes, the session transitions to `skill_completed` and then back to the primary state (`idle` or `processing`).

#### Scenario: Session enters skill_active on skill activation
- **WHEN** the `activateSkill(skillId)` method is called
- **THEN** the session state transitions to `skill_active`

#### Scenario: Session enters skill_paused for skill destructive approval
- **WHEN** a skill execution encounters a destructive tool during `skill_active` state
- **THEN** the session state transitions to `skill_paused`

#### Scenario: Session returns from skill_completed to primary state
- **WHEN** a skill completes successfully in `skill_completed` state
- **THEN** the session returns to the primary state (`idle` or `processing`)

### Requirement: Skill-Level Context Injection
The session manager SHALL manage skill-level context injection. When a skill is active, the session manager MUST prepend the skill's instructions to the system message before sending the request to the LLM adapter. When the skill ends, the skill instructions are stripped from the system message.

#### Scenario: Skill instructions are prepended to system message
- **WHEN** an LLM request is prepared while a skill is active
- **THEN** the skill's instructions are prepended to the system message before the existing SOUL.md content

#### Scenario: Skill instructions are stripped after completion
- **WHEN** a skill completes and the session transitions out of skill state
- **THEN** subsequent LLM requests no longer include the skill's instructions in the system message

### Requirement: Scheduled Job Session
The session manager SHALL support a special `background` session type used by the scheduler. Background sessions are identical to regular sessions but are created without a TUI connection, do not accept user input, and are managed entirely by the scheduler. Background sessions have a separate lifecycle from user-facing sessions and are automatically terminated when the skill completes.

#### Scenario: Background session is created for scheduled job
- **WHEN** the scheduler triggers a scheduled skill
- **THEN** the session manager creates a background-type session with its own session ID and no TUI connection

#### Scenario: Background session is auto-terminated on skill completion
- **WHEN** a scheduled skill completes (success or failure)
- **THEN** the background session terminates automatically and its metadata file is written
