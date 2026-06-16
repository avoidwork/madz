## ADDED Requirements

### Requirement: Event-Driven Command Registry
The TUI SHALL replace the switch-driven command parser with an event-driven command registry where commands are registered as objects with `validate`, `execute`, and `help` properties.

#### Scenario: Commands are registered as objects
- **WHEN** a new command is added
- **THEN** it is registered in the `commands` record with `name`, `description`, `usage`, `validate`, and `execute` properties

#### Scenario: Command validation runs before execution
- **WHEN** a command is invoked
- **THEN** the `validate` function runs first; if it returns an error string, the command is not executed and the error is displayed

#### Scenario: Unknown commands produce helpful error
- **WHEN** a user types an unrecognized command
- **THEN** the system responds: "Unknown command: /<command>. Type /help for available commands."

### Requirement: Registered Commands
The command registry SHALL include the following commands:

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
| `/skills` | Display registered skills in conversation stream |
| `/memory` | Display memory entries in conversation stream |

#### Scenario: /quit exits the application
- **WHEN** user types `/quit`
- **THEN** the application disconnects and exits

#### Scenario: /clear removes all messages
- **WHEN** user types `/clear`
- **THEN** the conversation panel is cleared and messages array is reset

#### Scenario: /skills displays skills in conversation
- **WHEN** user types `/skills`
- **THEN** the system displays registered skill names and descriptions in the conversation stream

#### Scenario: /memory displays memory entries
- **WHEN** user types `/memory`
- **THEN** the system displays recent memory entries in the conversation stream

### Requirement: Skill Execution Fallback
Unrecognized `/command` patterns that match a registered skill name SHALL be executed as skills, with the skill body (from `SKILL.md`) streamed to the agent as a prompt.

#### Scenario: Skill name matches registered skill
- **WHEN** user types `/skillName [args]`
- **THEN** the system loads the skill's `SKILL.md` and streams it to the agent
