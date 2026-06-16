## ADDED Requirements

### Requirement: Message Interface
The TUI SHALL render messages using a `Message` interface with the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `role` | `"user" | "assistant" | "system"` | Message author |
| `content` | `string` | Message text content |
| `time` | `string` | HH:MM format timestamp |
| `streaming` | `boolean` | True while content is being streamed |
| `reasoningContent` | `string` | Agent thinking (shown inline, truncated at 200 chars) |
| `activeToolCall` | `{ name: string }` | Currently running tool |
| `toolCallDisplay` | `string` | Completed tool calls (multi-line) |
| `toolCalls` | `{ name: string }[]` | Tool call history |
| `id` | `string` | Stable identifier for memoization |

#### Scenario: Message interface is defined in types
- **WHEN** the TUI defines message types
- **THEN** `Message` is exported from `state/types.js` with all required fields

#### Scenario: Streaming messages have streaming flag
- **WHEN** a message is being streamed
- **THEN** `message.streaming` is `true` and a streaming cursor character (`█`) is appended to `content`

### Requirement: Role-Based Styling
The TUI SHALL render messages with role-specific colors:

| Role | Label Color | Bubble Border | Alignment |
|------|------------|---------------|-----------|
| `user` | Green | Green | Right |
| `system` | Yellow | Yellow | Left |
| `assistant` | Cyan | Cyan | Left |

#### Scenario: User messages are right-aligned in green
- **WHEN** a user message is rendered
- **THEN** the message label and border are green and the message is right-aligned

#### Scenario: System messages are left-aligned in yellow
- **WHEN** a system message is rendered
- **THEN** the message label and border are yellow and the message is left-aligned

#### Scenario: Assistant messages are left-aligned in cyan
- **WHEN** an assistant message is rendered
- **THEN** the message label and border are cyan and the message is left-aligned

### Requirement: Message Memoization
The `MessageBubble` component SHALL use `React.memo` with a custom `areEqual` function that compares display-relevant fields (role, content, time, reasoningContent, streaming, toolCallDisplay, activeToolCall, id) to prevent unnecessary re-renders during streaming.

#### Scenario: Unchanged messages skip re-render
- **WHEN** a new message arrives and only the last message changes
- **THEN** all previous `MessageBubble` components skip re-render via `React.memo`

#### Scenario: Memoization compares display-relevant fields
- **WHEN** `React.memo`'s `areEqual` function runs
- **THEN** it compares role, content, time, reasoningContent, streaming, toolCallDisplay, activeToolCall, and id

### Requirement: Markdown Rendering
Assistant messages SHALL be rendered through `marked` + `marked-terminal`, which converts markdown to ANSI terminal text. A module-level parse cache (`Map`) SHALL avoid reparsing identical content across renders. The streaming cursor character (`█`) SHALL be stripped before parsing to avoid parser errors.

#### Scenario: Markdown is converted to ANSI terminal text
- **WHEN** an assistant message contains markdown
- **THEN** `marked` + `marked-terminal` converts it to ANSI-colored terminal text

#### Scenario: Parse cache avoids reparsing
- **WHEN** identical message content is rendered multiple times
- **THEN** the module-level `Map` cache returns the cached ANSI output

#### Scenario: Streaming cursor is stripped before parsing
- **WHEN** a streaming message is rendered
- **THEN** the `█` cursor character is stripped from the content before passing to `marked`
