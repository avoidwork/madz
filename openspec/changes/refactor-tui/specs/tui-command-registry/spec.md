## ADDED Requirements

### Requirement: Command parser uses event-driven registry
The command parser SHALL be refactored from a switch-driven dispatch table to an event-driven command registry where commands are registered as objects with `validate`, `execute`, and `help` properties.

#### Scenario: Command registration schema
- **WHEN** a new command is registered
- **THEN** it is an object with: `name: string`, `description: string`, `usage: string`, `validate: (args) => boolean | string`, `execute: (args, state, dispatch, helpers) => Promise<void> | void`

#### Scenario: Command validation
- **WHEN** a command is invoked with arguments
- **THEN** the registry calls `validate(args)` before executing
- **WHEN** validation returns a string (error message)
- **THEN** the error message is displayed to the user and execution is skipped

#### Scenario: Command execution
- **WHEN** a command passes validation
- **THEN** the registry calls `execute(args, state, dispatch, helpers)` with access to TUI state, dispatch, and command helpers

#### Scenario: Unknown command handling
- **WHEN** a command is not found in the registry
- **THEN** the TUI displays "Unknown command: /<command>. Type /help for available commands."

#### Scenario: Help command
- **WHEN** the user types `/help`
- **THEN** the TUI displays all registered commands grouped by category (Chat, Command, etc.)

### Requirement: Command helpers provide necessary context
Commands SHALL receive a `CommandHelpers` object providing access to `dispatchProvider`, `sessionState`, `config`, and `scrollRef`.

#### Scenario: Command can dispatch provider
- **WHEN** a command needs to send a message to the agent
- **THEN** it uses `helpers.dispatchProvider` to trigger the streaming pipeline

#### Scenario: Command can access session state
- **WHEN** a command needs to read or modify session data
- **THEN** it uses `helpers.sessionState` to interact with the session manager

#### Scenario: Command can access config
- **WHEN** a command needs to read or modify configuration
- **THEN** it uses `helpers.config` to access the current configuration

#### Scenario: Command can control scroll
- **WHEN** a command needs to scroll the viewport
- **THEN** it uses `helpers.scrollRef` to call `scrollToBottom()` or `scrollBy()`
