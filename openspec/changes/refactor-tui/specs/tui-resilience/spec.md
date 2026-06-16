## ADDED Requirements

### Requirement: Terminal Resize Handling
The TUI SHALL detect terminal resize events via `stdout.on("resize")` and call `scrollRef.current.remeasure()` to update viewport dimensions. The `ink-scroll-view` component SHALL handle re-layout automatically.

#### Scenario: Resize event triggers remeasure
- **WHEN** the terminal is resized
- **THEN** the `resizeHandler` calls `scrollRef.current.remeasure()` to update viewport dimensions

#### Scenario: Resize handler is cleaned up on unmount
- **WHEN** the TUI component unmounts
- **THEN** the `resize` event listener is removed via `stdout.off("resize", resizeHandler)`

#### Scenario: Resize is skipped in CI
- **WHEN** the TUI runs in a CI environment (`process.env.CI`)
- **THEN** the resize handler does not call `remeasure()` to avoid TTY errors

### Requirement: Streaming Overflow Handling
The TUI SHALL handle streaming overflow by tracking a content hash (`messageCount + streamingContentLength`) that triggers re-evaluation. `scrollToBottom()` SHALL be deferred 0ms to allow `ink-scroll-view`'s `useLayoutEffect` to complete.

#### Scenario: Content hash triggers scroll re-evaluation
- **WHEN** a new message arrives during streaming
- **THEN** the content hash is compared against the previous hash to determine if scroll is needed

#### Scenario: Scroll is deferred to allow layout
- **WHEN** scroll-to-bottom is triggered
- **THEN** it is deferred via `setTimeout(scrollHandle, 0)` to allow React to commit the layout

#### Scenario: Redundant scrolls are avoided
- **WHEN** the content hash has not changed
- **THEN** `scrollToBottom()` is not called again

### Requirement: Connection Loss Handling
The TUI SHALL handle connection errors gracefully: display a system message with the error, clear the streaming message from the UI, and persist the session.

#### Scenario: Connection error displays system message
- **WHEN** an error occurs in `dispatchProvider`
- **THEN** the system displays: "I couldn't connect right now - {error}. Try sending your message again?"

#### Scenario: Streaming message is cleared on error
- **WHEN** a connection error occurs during streaming
- **THEN** the partial streaming message is removed from the UI

#### Scenario: Session is saved on error
- **WHEN** a connection error occurs
- **THEN** the `onSaveSession` callback is invoked to persist the current session

### Requirement: Model Stuck in Thinking Loop Detection
The TUI SHALL detect when the model is stuck in a thinking loop by tracking consecutive empty responses. After `config.agent.autoContinueLimit` (default 1000) empty responses, the system SHALL show an error message, reset the counter, and require the user to rephrase or start a new session.

#### Scenario: Empty response counter increments
- **WHEN** the agent returns zero text output
- **THEN** the auto-continue counter increments by one

#### Scenario: Circuit breaker trips after limit
- **WHEN** the auto-continue counter reaches `config.agent.autoContinueLimit` (default 1000)
- **THEN** the system shows an error message, resets the counter, and requires user rephrase or new session

#### Scenario: Counter resets on text output
- **WHEN** any text output arrives during auto-continue
- **THEN** the auto-continue counter resets to zero

### Requirement: Output Retention Policy
The TUI SHALL render whatever messages are in its state array. Memory management (compaction, trimming) SHALL be handled by the session layer, not the TUI.

#### Scenario: TUI renders all messages in state
- **WHEN** messages are added to the TUI state array
- **THEN** all messages are rendered in the conversation panel

#### Scenario: Memory management is session-layer responsibility
- **WHEN** the conversation grows large
- **THEN** compaction and trimming are handled by `sessionState`, not the TUI
