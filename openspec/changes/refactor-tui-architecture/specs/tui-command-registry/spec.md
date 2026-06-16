## ADDED Requirements

### Requirement: Event-Driven Command Registry
The system SHALL replace the switch-driven command dispatch table with an event-driven command registry where commands are registered as objects with `validate`, `execute`, and `help` properties.

#### Scenario: Command registration
- **WHEN** a command is registered with the registry
- **THEN** it is stored with its name, description, usage, validate function, and execute function

#### Scenario: Command validation
- **WHEN** a command is invoked with arguments
- **THEN** the validate function is called first and returns an error message on failure

#### Scenario: Command execution
- **WHEN** a command passes validation
- **THEN** the execute function is called with args, state, dispatch, and helpers

#### Scenario: Unknown commands are handled
- **WHEN** a user types an unrecognized /command
- **THEN** the system responds with "Unknown command: /commandName. Type /help for available commands."

### Requirement: Command Helpers
The system SHALL provide a CommandHelpers interface to command execute functions containing dispatchProvider, sessionState, config, and scrollRef.

#### Scenario: Commands receive dispatchProvider
- **WHEN** a command's execute function is called
- **THEN** it receives dispatchProvider for initiating agent calls

#### Scenario: Commands receive sessionState
- **WHEN** a command's execute function is called
- **THEN** it receives sessionState for session management

#### Scenario: Commands receive config
- **WHEN** a command's execute function is called
- **THEN** it receives the current config object

#### Scenario: Commands receive scrollRef
- **WHEN** a command's execute function is called
- **THEN** it receives scrollRef for scroll control

### Requirement: Registered Commands
The system SHALL support the following commands through the registry: /quit, /clear, /new, /help, /config set, /provider set, /schedule list, /schedule pause, /schedule resume, /schedule run-now, /gc, /gc status.

#### Scenario: /quit exits the application
- **WHEN** the user types /quit
- **THEN** the system disconnects and exits

#### Scenario: /clear clears the conversation
- **WHEN** the user types /clear
- **THEN** the system clears all messages from the conversation

#### Scenario: /gc triggers garbage collection
- **WHEN** the user types /gc
- **THEN** the system triggers V8 garbage collection if enabled

#### Scenario: /gc status shows GC status
- **WHEN** the user types /gc status
- **THEN** the system displays the current GC configuration and status
