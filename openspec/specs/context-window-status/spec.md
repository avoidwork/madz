## ADDED Requirements

### Requirement: Status bar displays current context window size
The TUI status bar SHALL display the current number of messages in the session conversation as `context:N`, positioned immediately after `msg:N`.

#### Scenario: Context size shown on startup
- **WHEN** the TUI starts with a new session
- **THEN** the status bar displays `skills:N msg:0 context:0`

#### Scenario: Context size increments on exchange
- **WHEN** the user sends a message and receives a response
- **THEN** the context count increments by 2 (one user message + one assistant message)

#### Scenario: Context size resets on new session
- **WHEN** the user starts a new session via `:new` command
- **THEN** the context count resets to 0

#### Scenario: Context size reflects session state
- **WHEN** the session conversation changes
- **THEN** the displayed context count matches `sessionState.getConversation().length`

### Requirement: Context display turns red during compaction
The `context:N` display SHALL render in red color when the agent is performing conversation compaction, and return to the default color when compaction completes.

#### Scenario: Context turns red on compaction start
- **WHEN** a context length error triggers conversation compaction
- **THEN** the `context:N` text renders in red color

#### Scenario: Context returns to default on compaction end
- **WHEN** compaction completes (success, failure, or retry exhaustion)
- **THEN** the `context:N` text returns to the default `#606060` color

#### Scenario: Context stays red across multiple compaction retries
- **WHEN** compaction retries up to 3 times
- **THEN** the `context:N` text remains red throughout all retry attempts

#### Scenario: Context clears red on non-compaction errors
- **WHEN** a non-context-length error occurs during streaming
- **THEN** the `context:N` text remains in the default color (not red)
