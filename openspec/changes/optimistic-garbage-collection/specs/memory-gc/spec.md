## ADDED Requirements

### Requirement: GC Message Window
The system SHALL maintain a configurable message window in the TUI, trimming the `messages` array to retain only the most recent N messages (default: 100).

#### Scenario: Messages are trimmed after exceeding window
- **WHEN** the TUI messages array exceeds the configured `memory.gc.messageWindow` (default 100)
- **THEN** the oldest messages beyond the window are removed from the array

#### Scenario: GC runs non-blocking after exchange
- **WHEN** a new message exchange completes (user input + AI response)
- **THEN** garbage collection is queued via `queueMicrotask` to trim the messages array without blocking

#### Scenario: GC runs on TUI idle
- **WHEN** the TUI has been idle for the configured interval (`memory.gc.idleMs`, default: 30000ms)
- **THEN** garbage collection is triggered to trim accumulated messages

### Requirement: GC Memory Context Entry Limit
The system SHALL enforce a maximum number of memory context entries loaded into memory (default: 100), removing the oldest entries when the limit is exceeded.

#### Scenario: Memory context entries are trimmed when limit exceeded
- **WHEN** the number of entries in `memory/context/` exceeds `memory.gc.maxContextEntries` (default 100)
- **THEN** the oldest entries (by file modification time) are removed from disk and from memory

#### Scenario: GC runs non-blocking for memory context
- **WHEN** memory context entries are loaded via `loadMemories`
- **THEN** `enforceMaxEntries` is called afterward to enforce the configured limit

### Requirement: GC Utility Function
The system SHALL expose a `gcCollect()` function that performs all garbage collection operations in a single pass.

#### Scenario: GC collect trims messages
- **WHEN** `gcCollect()` is called
- **THEN** the TUI messages array is trimmed to the configured message window

#### Scenario: GC collect trims memory context
- **WHEN** `gcCollect()` is called
- **THEN** memory context entries are enforced against the configured maximum count

#### Scenario: GC collect is idempotent
- **WHEN** `gcCollect()` is called multiple times in succession
- **THEN** subsequent calls produce no additional side effects (no errors, no double-trimming)

### Requirement: GC Manual Trigger Command
The system SHALL expose a `:gc` TUI command that triggers manual garbage collection.

#### Scenario: User triggers GC via command
- **WHEN** the user types `:gc` in the TUI input
- **THEN** garbage collection runs immediately and a status message is displayed confirming the operation

#### Scenario: GC command reports no work needed
- **WHEN** the user types `:gc` and no trimming was necessary
- **THEN** a status message is displayed indicating GC ran with nothing to trim
