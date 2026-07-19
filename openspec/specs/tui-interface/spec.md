## Purpose

Define the TUI interface capabilities including interactive chat, batch execution, pipeline output, keyboard navigation, command entry, and the startup banner.
## Requirements
### Requirement: Interactive Chat Mode
The system SHALL provide an interactive conversational mode where users can type messages, receive LLM responses, and view conversation history in a scrollable terminal buffer.

#### Scenario: User sends a message and receives a response
- **WHEN** user types a message in the input panel and presses Enter
- **THEN** the system displays the user message followed by the LLM response in the conversation panel

#### Scenario: User scrolls through conversation history
- **WHEN** the conversation exceeds the visible terminal height
- **THEN** the user can scroll up to view prior messages using page-up/page-down or arrow keys

### Requirement: Batch Execution Mode
The system SHALL allow users to submit a multi-step task definition for non-interactive execution and display structured output upon completion.

#### Scenario: User submits a batch task
- **WHEN** user enters batch mode and provides a task definition
- **THEN** the system executes the task steps sequentially and outputs the result in structured format

#### Scenario: Batch task fails mid-execution
- **WHEN** a step within a batch task fails
- **THEN** the system logs the error in memory and reports partial results to the user

### Requirement: Pipeline Output Mode
The system SHALL support pipeline-friendly output formatting (machine-readable JSON or CSV) when invoked with a `--format` flag.

#### Scenario: User invokes pipeline mode with JSON format
- **WHEN** user runs the harness with `--format json`
- **THEN** the system outputs results as valid JSON to stdout

#### Scenario: User invokes pipeline mode with CSV format
- **WHEN** user runs the harness with `--format csv`
- **THEN** the system outputs tabular results as valid CSV to stdout

### Requirement: Keyboard Navigation
The system SHALL support panel-based keyboard navigation using Tab, Shift+Tab, and arrow keys to switch between the conversation, memory, skills, and settings panels.

#### Scenario: User navigates between panels
- **WHEN** user presses Tab in the TUI
- **THEN** focus cycles to the next panel in the order: conversation → skills → memory → settings → conversation

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

### Requirement: Startup Banner Display
The system SHALL display a BBS-style startup banner with ASCII art and a built-in command help menu when the TUI enters interactive mode. The banner SHALL also display the application version string below the ASCII art.

#### Scenario: Banner renders on TUI launch
- **WHEN** the user starts the app in interactive mode (`--mode interactive`)
- **THEN** the system renders a banner containing ASCII art (project logo), the application version string below the ASCII art, and a grouped list of available commands before showing the conversation panel

#### Scenario: Banner dismisses on any key press
- **WHEN** the banner is displayed and the user presses any key
- **THEN** the system hides the banner and immediately displays the normal chat interface with the conversation panel and input bar

#### Scenario: Banner does not appear in CLI mode
- **WHEN** the user runs the app in chat/batch mode (without `--mode interactive`)
- **THEN** the system does not render the banner

