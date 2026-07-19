## MODIFIED Requirements

### Requirement: TUI Command Entry
The system SHALL allow users to issue commands via a slash-syntax (`/command`) input mode for system control such as provider switching, config editing, schedule management, and exiting the application. The system SHALL support both `/quit` and `/exit` as commands to terminate the application — both invoke the same shutdown handler and behave identically.

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
