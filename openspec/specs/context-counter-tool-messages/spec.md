# context-counter-tool-messages Specification

## Purpose
TBD - created by archiving change fix-context-counter-tool-messages. Update Purpose after archive.
## Requirements
### Requirement: Live streaming context counter SHALL include tool-message tokens
The live streaming context counter SHALL include tool-message tokens as they stream in, decoupled from tool-message display.

#### Scenario: tool_message event increments the context counter
- **WHEN** a `tool_message` streaming event is received during a turn
- **THEN** the tool-message token count is accumulated and included in the live context counter update

#### Scenario: showToolResults false still emits tool_message for counting
- **WHEN** `showToolResults` is `false` and a ToolMessage is encountered
- **THEN** a `tool_message` event is still emitted carrying the tool text so the TUI can count it, even though the tool text is not displayed

#### Scenario: displayed message text is not polluted by tool content
- **WHEN** a `tool_message` event is received
- **THEN** the tool text is not folded into the displayed assistant message content

### Requirement: Tool-message token ref SHALL reset per turn
The tool-message token accumulator SHALL be reset at the start of each turn so tool tokens from a previous turn do not leak into the next.

#### Scenario: tool tokens reset at start of handleChat
- **WHEN** `handleChat` begins a new turn
- **THEN** the tool-message token accumulator is reset to zero

