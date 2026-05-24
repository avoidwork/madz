## ADDED Requirements

### Requirement: TUI launches and renders main screen
The system SHALL launch an Ink-based terminal interface displaying a message history area, an input prompt, and a status bar on startup.

#### Scenario: Application starts rendering
- **WHEN** the user runs `node index.js`
- **THEN** the terminal displays the message history area, input prompt, and status bar within 1 second

#### Scenario: Window resizes gracefully
- **WHEN** the terminal window is resized
- **THEN** the TUI reflows components to fit the new dimensions without crashing

### Requirement: Conversational interaction mode
The system SHALL accept user text input at the prompt and display LLM responses in the message history area.

#### Scenario: User sends a message
- **WHEN** the user types text and presses Enter at the input prompt
- **THEN** the system sends the message to the LLM provider via the selected adapter and displays the response in the message history

#### Scenario: Streaming response display
- **WHEN** the LLM provider returns a streaming response
- **THEN** the TUI appends output incrementally in real-time rather than waiting for the complete response

#### Scenario: Long running response handling
- **WHEN** a response takes more than 30 seconds to complete
- **THEN** the TUI displays a loading indicator without blocking input for the next message

### Requirement: Batch execution mode
The system SHALL accept a pre-written task specification and execute it non-interactively, outputting results in a specified format.

#### Scenario: Batch mode from file
- **WHEN** the user runs `node index.js --batch task.yaml`
- **THEN** the system reads the task configuration and executes it without launching the interactive TUI

#### Scenario: Pipeline output mode
- **WHEN** the user specifies `--output json` with batch mode
- **THEN** the system outputs structured JSON results to stdout suitable for pipe consumption

### Requirement: Command-mode interface
The system SHALL support slash commands for system-level operations while conversational messages are processed normally.

#### Scenario: Help command
- **WHEN** the user types `/help` at the input prompt
- **THEN** the system displays a list of available commands with brief descriptions

#### Scenario: Provider switch command
- **WHEN** the user types `/provider openai-gpt-4o` at the input prompt
- **THEN** the system updates the active LLM provider for subsequent messages

#### Scenario: Session management commands
- **WHEN** the user types `/memory save` or `/memory clear`
- **THEN** the system saves or clears the current conversation context

### Requirement: Keyboard navigation
The system SHALL support keyboard navigation for message history scrolling, command input, and mode switching.

#### Scenario: Up arrow scrolls history
- **WHEN** the user presses the up arrow key
- **THEN** the system cycles through previous messages in the input prompt for editing

#### Scenario: Tab completion
- **WHEN** the user types `/` followed by Tab at the input prompt
- **THEN** the system displays available slash commands and inserts the selected command
