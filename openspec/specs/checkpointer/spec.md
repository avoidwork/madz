## ADDED Requirements

### Requirement: Checkpointer factory creates the appropriate checkpointer instance
The system SHALL provide a `createCheckpointer(persistenceConfig)` function at `src/session/checkpointer.js` that returns a LangGraph-compatible checkpointer instance based on the `persistence.mode` config value. Supported modes are `"memory"` (uses `InMemorySaver`) and `"sqlite"` (uses `AsyncSqliteSaver`).

#### Scenario: Memory mode returns InMemorySaver
- **WHEN** `createCheckpointer` is called with `{ mode: "memory" }` or no argument
- **THEN** the function returns an `InMemorySaver` instance from `langgraph-checkpoint`

#### Scenario: SQLite mode returns AsyncSqliteSaver
- **WHEN** `createCheckpointer` is called with `{ mode: "sqlite", sqlitePath: "memory/checkpoints.db" }`
- **THEN** the function returns an `AsyncSqliteSaver` instance from `langgraph-checkpoint-sqlite` connected to the specified database file

#### Scenario: Unknown mode defaults to memory
- **WHEN** `createCheckpointer` is called with `{ mode: "redis" }` (an unsupported mode)
- **THEN** the function falls back to returning an `InMemorySaver` instance

### Requirement: Checkpointer is optional and backward compatible
The checkpointer is an optional component. When no checkpointer is configured, the agent operates statelessly just as it does today.

#### Scenario: No persistence config produces no checkpointer
- **WHEN** `createCheckpointer` is called with `null` or `undefined`
- **THEN** the function returns `null` (no checkpointer)

### Requirement: Checkpointer state is isolated per thread
Each unique `thread_id` passed to the checkpointer results in a separate checkpoint chain with no state leakage between threads.

#### Scenario: Different thread_ids have independent checkpoints
- **WHEN** the same agent is invoked with `thread_id: "a"` and `thread_id: "b"`
- **THEN** the conversation state from thread "a" is not visible when querying thread "b"
