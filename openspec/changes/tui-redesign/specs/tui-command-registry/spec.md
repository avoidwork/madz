## ADDED Requirements

### Requirement: Event-Driven Command Registry
The TUI SHALL replace the switch-driven command parser with an event-driven command registry where commands are registered as objects with `validate`, `execute`, and `help` properties.

#### Scenario: Commands are registered as objects
- **WHEN** the command registry is initialized
- **THEN** each command is a `{ name, description, usage, validate, execute }` object stored in a `Record<string, Command>`

#### Scenario: Command validation runs before execution
- **WHEN** a command is dispatched
- **THEN** the `validate` function runs first and returns an error message on failure
- **WHEN** validation fails
- **THEN** the command is not executed and the error message is displayed to the user

#### Scenario: Unknown commands produce a helpful response
- **WHEN** a user types an unrecognized `/command`
- **THEN** the system responds with "Unknown command: /command. Type /help for available commands."

#### Scenario: Unrecognized skill patterns execute as skills
- **WHEN** a user types `/skillName [args]` where `skillName` matches a registered skill
- **THEN** the skill body is loaded and streamed to the agent as a prompt

### Requirement: Registered Commands
The TUI SHALL support the following commands via the registry:

| Command | Behavior |
|---------|----------|
| `/quit` | Disconnect and exit |
| `/clear` | Clear conversation |
| `/new` | Start a new session |
| `/help` | Show available commands |
| `/config set <path> <value>` | Set a config value |
| `/provider set <name>` | Switch AI provider |
| `/schedule list` | List scheduled tasks |
| `/schedule pause <name>` | Pause a scheduled task |
| `/schedule resume <name>` | Resume a scheduled task |
| `/schedule run-now <name>` | Run a scheduled task immediately |
| `/gc` | Trigger V8 garbage collection |
| `/gc status` | Show GC status |

#### Scenario: /quit exits the application
- **WHEN** the user types `/quit`
- **THEN** the application disconnects and exits

#### Scenario: /clear removes all messages
- **WHEN** the user types `/clear`
- **THEN** the conversation panel is cleared and messages array is reset to empty

#### Scenario: /help shows available commands
- **WHEN** the user types `/help`
- **THEN** the system displays a grouped list of available commands with descriptions

#### Scenario: /config set updates configuration
- **WHEN** the user types `/config set tui.autoScroll false`
- **THEN** the configuration value is updated and takes effect immediately
