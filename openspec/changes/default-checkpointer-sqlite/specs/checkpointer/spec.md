## MODIFIED Requirements

### Requirement: Checkpointer factory creates the appropriate checkpointer instance
The system SHALL provide a `createCheckpointer(persistenceConfig)` function at `src/session/checkpointer.js` that returns a LangGraph-compatible checkpointer instance based on the `persistence.mode` config value. Supported modes are `"memory"` (uses `InMemorySaver`) and `"sqlite"` (uses `AsyncSqliteSaver`). The default mode when no config is provided is `"sqlite"`.

#### Scenario: SQLite mode returns AsyncSqliteSaver
- **WHEN** `createCheckpointer` is called with `{ mode: "sqlite" }` or no argument
- **THEN** the function returns an `AsyncSqliteSaver` instance from `@langchain/langgraph-checkpoint-sqlite` connected to the configured SQLite path

#### Scenario: Memory mode returns InMemorySaver
- **WHEN** `createCheckpointer` is called with `{ mode: "memory" }`
- **THEN** the function returns an `InMemorySaver` instance from `langgraph-checkpoint`

#### Scenario: Unknown mode defaults to memory
- **WHEN** `createCheckpointer` is called with `{ mode: "redis" }` (an unsupported mode)
- **THEN** the function falls back to returning an `InMemorySaver` instance

## MODIFIED Requirements

### Requirement: Checkpointer is optional and backward compatible
The checkpointer is an optional component. When no checkpointer is configured, the agent operates statelessly just as it does today. When called with `null` or `undefined`, the function returns an `AsyncSqliteSaver` instance (the new default).

#### Scenario: No persistence config produces SQLite checkpointer
- **WHEN** `createCheckpointer` is called with `null` or `undefined`
- **THEN** the function returns an `AsyncSqliteSaver` instance (defaulting to SQLite mode)
