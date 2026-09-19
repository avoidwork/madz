## MODIFIED Requirements

### Requirement: TUI Command Entry
The system SHALL allow users to issue commands via a slash-syntax (`/command`) input mode for system control such as provider switching, config editing, schedule management, and exiting the application. The system SHALL support both `/quit` and `/exit` as commands to terminate the application — both invoke the same shutdown handler and behave identically. The system SHALL route `/skill-name` slash commands through the deepagents skill system (synthesizing the `Run the <skill> skill [args]` prompt and dispatching it through the normal chat path) rather than loading the SKILL.md body and feeding it to the model as a plain chat prompt.

#### Scenario: User toggles provider via command
- **WHEN** user types `/provider set openai` in command mode
- **THEN** the system switches the active LLM provider to OpenAI and persists the change in `config.yaml`

#### Scenario: User opens memory index via command
- **WHEN** user types `/memory open` in command mode
- **THEN** the system displays the last 50 memory entries in the memory panel

#### Scenario: User exits via /quit command
- **WHEN** user types `/quit` in command mode
- **THEN** the system returns `{ action: "quit", value: true, message: "Quitting." }` and initiates shutdown

#### Scenario: User exits via /exit command
- **WHEN** user types `/exit` in command mode
- **THEN** the system returns `{ action: "quit", value: true, message: "Quitting." }` and initiates shutdown, identical to `/quit`

#### Scenario: User invokes a skill via slash command
- **WHEN** user types `/audit-code` in command mode
- **THEN** the system synthesizes the prompt `Run the audit-code skill` and dispatches it through the normal chat path, which routes through the deepagents orchestrator that has the skill attached

#### Scenario: User invokes an unknown skill via slash command
- **WHEN** user types `/nonexistent-skill` in command mode and the skill is not in the skill list
- **THEN** the system returns an unknown-command result indicating the command is not recognized
