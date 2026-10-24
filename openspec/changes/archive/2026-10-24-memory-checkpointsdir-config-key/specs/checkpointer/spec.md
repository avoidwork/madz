## MODIFIED Requirements

### Requirement: Checkpointer factory creates the appropriate checkpointer instance
The system SHALL provide a `createCheckpointer(persistenceConfig)` function at `src/session/checkpointer.js` that returns a LangGraph-compatible checkpointer instance based on the `persistence.mode` config value. Supported modes are `"memory"` (uses `InMemorySaver`) and `"sqlite"` (uses `AsyncSqliteSaver`). The default mode when no config is provided is `"sqlite"`.

#### Scenario: SQLite mode returns AsyncSqliteSaver
- **WHEN** `createCheckpointer` is called with `{ mode: "sqlite" }` or no argument
- **THEN** the function returns an `AsyncSqliteSaver` instance from `@langchain/langgraph-checkpoint-sqlite` connected to the configured SQLite path

#### Scenario: SQLite mode honors configured checkpointsDir
- **WHEN** `createCheckpointer` is called with `{ mode: "sqlite" }` and `fullConfig.memory.checkpointsDir` is set to a custom directory
- **THEN** the SQLite path is resolved from the configured `memory.checkpointsDir` rather than the hardcoded default

#### Scenario: Memory mode returns InMemorySaver
- **WHEN** `createCheckpointer` is called with `{ mode: "memory" }`
- **THEN** the function returns an `InMemorySaver` instance from `langgraph-checkpoint`

#### Scenario: Unknown mode defaults to memory
- **WHEN** `createCheckpointer` is called with `{ mode: "redis" }` (an unsupported mode)
- **THEN** the function falls back to returning an `InMemorySaver` instance
