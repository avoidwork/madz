# tui-compact-command Specification

## Purpose
The `/compact` slash command in the TUI that manually compresses the context window on demand, removes messages containing vision blocks (base64 image data), and trims/summarizes older messages so the context window is reduced.

## Requirements
### Requirement: Register /compact command in dispatch table
The system SHALL register a `/compact` command in the TUI command parser dispatch table (`src/tui/commandParser.js`) that returns `{ action: "compact" }`.

#### Scenario: Parse /compact command
- **WHEN** the user types `/compact` in the TUI input
- **THEN** the command parser returns `{ action: "compact" }`

#### Scenario: /compact is listed as a registered command
- **WHEN** the command parser's `listCommands()` is called
- **THEN** the returned list includes `compact`

### Requirement: Handle compact action in conversation area
The system SHALL handle `result.action === "compact"` in `src/tui/conversationArea.js` `handleCommand`, invoking a compaction routine and reporting the result via `onStatusChange`.

#### Scenario: Compact action invokes compaction routine
- **WHEN** `handleCommand` receives a result with `action === "compact"`
- **THEN** the compaction routine is invoked and the result is reported via `onStatusChange`

#### Scenario: Compaction failure is reported
- **WHEN** the compaction routine throws an error
- **THEN** the error is reported via `onStatusChange` and the command handler does not crash

### Requirement: Expose compaction path from agent to TUI
The system SHALL expose a compaction path from the agent (`src/agent/deepAgents.js`) to the TUI by threading either the agent or a `compactContext` callback into the `App` props.

#### Scenario: Agent exposes compactContext callback
- **WHEN** `createDeepAgentsOrchestrator` returns the agent
- **THEN** the agent exposes a `compactContext` callback that compacts the agent's message state

#### Scenario: App receives compactContext prop
- **WHEN** `App` is rendered with the agent's `compactContext`
- **THEN** the `compactContext` is threaded into `ConversationArea`

### Requirement: Compaction removes vision blocks
The system SHALL walk the agent's message state and remove messages that contain a vision block — a `readImage` ToolMessage whose content JSON has a non-empty `data` field, and/or messages with `image_url` content blocks.

#### Scenario: Remove readImage ToolMessage with base64 data
- **WHEN** the agent's message state contains a `readImage` ToolMessage whose content JSON has a non-empty `data` field
- **THEN** the compaction routine removes that message

#### Scenario: Remove message with image_url content block
- **WHEN** the agent's message state contains a message with an `image_url` content block
- **THEN** the compaction routine removes that message

#### Scenario: Preserve messages without vision blocks
- **WHEN** the agent's message state contains messages without vision blocks
- **THEN** the compaction routine preserves those messages

### Requirement: Compaction trims older messages
The system SHALL trim/summarize the remaining older messages so the context window is compressed, preserving recent messages.

#### Scenario: Older messages are trimmed
- **WHEN** the agent's message state has more messages than the retention window
- **THEN** the compaction routine trims the older messages while preserving recent ones

#### Scenario: Recent messages are preserved
- **WHEN** the compaction routine trims older messages
- **THEN** the most recent messages are preserved

### Requirement: Sync checkpointer and session state
The system SHALL update both the checkpointer state (via `agent.updateState`) and `sessionState.getConversation()` so the TUI and model agree after compaction.

#### Scenario: Checkpointer state is updated
- **WHEN** the compaction routine completes
- **THEN** the checkpointer state is updated via `agent.updateState`

#### Scenario: Session state conversation is updated
- **WHEN** the compaction routine completes
- **THEN** `sessionState.getConversation()` reflects the compacted messages

### Requirement: Recompute context size after compaction
The system SHALL recompute `contextSize` via `updateContextSize` after compaction so the status bar reflects the reduced window.

#### Scenario: Context size is recomputed
- **WHEN** the compaction routine completes
- **THEN** `updateContextSize` is called and the status bar reflects the reduced context window
