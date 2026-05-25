## ADDED Requirements

### Requirement: SQLite Checkpointer Creation
The system SHALL create a `SQLiteSaver` checkpointer instance via `@langchain/langgraph-checkpoint-sqlite` when `agent.checkpoints.enabled` is `true` in the configuration, using the path specified by `agent.checkpoints.dbPath`.

#### Scenario: Checkpointer is created when enabled
- **WHEN** `config.yaml` sets `agent.checkpoints.enabled: true` with `agent.checkpoints.dbPath: "memory/checkpoints/db.sqlite"`
- **THEN** the system instantiates `SQLiteSaver` with that path and passes it to the ReAct agent graph

#### Scenario: Checkpointer defaults when not configured
- **WHEN** `agent.checkpoints` is omitted from `config.yaml`
- **THEN** the system defaults to `enabled: true` and `dbPath: "memory/checkpoints/db.sqlite"`

#### Scenario: Checkpointer is disabled
- **WHEN** `config.yaml` sets `agent.checkpoints.enabled: false`
- **THEN** the system creates the agent without a checkpointer (no `SQLiteSaver` instance)

#### Scenario: Native binding failure falls back gracefully
- **WHEN** `better-sqlite3` native binding fails to load at checkpointer creation time
- **THEN** the system logs a warning without throwing and falls back to no checkpointer

### Requirement: Thread ID in Agent Invocation
Every invocation of the ReAct agent (both sync and streaming) SHALL pass a `configurable: { thread_id }` object so that LangGraph's checkpointer routes state to the correct session.

#### Scenario: Sync invocation includes thread_id
- **WHEN** a non-streaming agent call is made with an active session
- **THEN** the invocation includes `{ configurable: { thread_id: sessionId } }` in the config parameter

#### Scenario: Streaming invocation includes thread_id
- **WHEN** a streaming agent call is made with an active session
- **THEN** the `streamEvents` call includes `{ configurable: { thread_id: sessionId } }` in the config parameter

### Requirement: Checkpointer is Wired at Startup
The checkpointer SHALL be instantiated during application startup in `index.js` and passed to the agent creation function `createReactAgent`.

#### Scenario: Checkpointer passes through agent factory
- **WHEN** the application starts with `agent.checkpoints.enabled: true`
- **THEN** `createReactAgent` receives the `SQLiteSaver` instance and forwards it to `createReactAgentGraph`

#### Scenario: No checkpointer when disabled
- **WHEN** `agent.checkpoints.enabled: false`
- **THEN** `createReactAgent` is called with `checkpointer: undefined` and the agent is created without persistence
