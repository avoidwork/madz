# tui-cancelled-tool-messages Specification

## Purpose
TBD - created by archiving change hide-cancelled-tool-messages. Update Purpose after archive.

## Requirements

### Requirement: Cancelled tool messages are not rendered as tool calls
The TUI SHALL NOT render the synthetic cancelled ToolMessage (status "error", content matching "was cancelled - another message came in before it could be completed.") as a tool call, in the live stream or in restored history, while it SHALL remain in the provider message history.

#### Scenario: Live stream
- **WHEN** a cancelled tool message event arrives
- **THEN** no tool segment is rendered and its tokens still count toward context

#### Scenario: Restored history
- **WHEN** history containing a cancelled tool message is restored
- **THEN** the message is flagged `cancelled` and the message list skips it

#### Scenario: Other tool messages
- **WHEN** a normal tool message or a non-cancelled error tool message arrives
- **THEN** it renders as usual
