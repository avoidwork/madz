## MODIFIED Requirements

### Requirement: Status bar displays current context window size
The TUI status bar SHALL display the current context-window utilization as a visual meter (e.g. `[▮▮▮▯▯▯] 62%`) rather than a bare `context:N` number, positioned immediately after `msg:N`. The meter SHALL reflect the proportion of the context window used, computed as `contextSize / contextWindow`. When `contextWindow <= 0` (unset), the meter SHALL fall back to the bare `formatSize(contextSize)` number.

#### Scenario: Context meter shown on startup
- **WHEN** the TUI starts with a new session
- **THEN** the status bar displays `skills:N msg:0` followed by a context meter showing 0% utilization

#### Scenario: Context meter increments on exchange
- **WHEN** the user sends a message and receives a response
- **THEN** the context meter reflects the increased context utilization

#### Scenario: Context meter resets on new session
- **WHEN** the user starts a new session via `:new` command
- **THEN** the context meter resets to 0% utilization

#### Scenario: Context meter reflects session state
- **WHEN** the session conversation changes
- **THEN** the displayed context meter matches the current context utilization

#### Scenario: Context meter falls back to bare number when context window is unset
- **WHEN** the active provider does not configure a context window (`contextWindow <= 0`)
- **THEN** the status bar displays the bare `formatSize(contextSize)` number instead of a meter

### Requirement: Context display turns red during compaction
The context meter SHALL render in red color when the agent is performing conversation compaction, and return to the default color when compaction completes.

#### Scenario: Context turns red on compaction start
- **WHEN** a context length error triggers conversation compaction
- **THEN** the context meter renders in red color

#### Scenario: Context returns to default on compaction end
- **WHEN** compaction completes (success, failure, or retry exhaustion)
- **THEN** the context meter returns to the default `#606060` color

#### Scenario: Context stays red across multiple compaction retries
- **WHEN** compaction retries up to 3 times
- **THEN** the context meter remains red throughout all retry attempts

#### Scenario: Context clears red on non-compaction errors
- **WHEN** a non-context-length error occurs during streaming
- **THEN** the context meter remains in the default color (not red)
