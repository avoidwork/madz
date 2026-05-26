## ADDED Requirements

### Requirement: Graph with SQLite Checkpointer

The system SHALL compile a `StateGraph` with a `SqliteSaver` checkpointer configured via `config.yaml` (`sqlite.path`), persisting graph state at every super-step boundary to the SQLite database at the configured path.

#### Scenario: Graph compiles with checkpointer

- **WHEN** `buildCheckpointedGraph()` is called with a model, tools, and database path
- **THEN** the system returns a compiled `StateGraph` with a `SqliteSaver` attached and no errors

#### Scenario: Checkpoint is created on graph invocation

- **WHEN** the compiled graph is invoked with `{ configurable: { thread_id: "<id>" } }`
- **THEN** a checkpoint snapshot is stored in the SQLite database for that thread

#### Scenario: Checkpoint database path is configurable

- **WHEN** `config.yaml` sets `sqlite.path: "memory/checkpoints.db"`
- **THEN** the `SqliteSaver` initializes using that file path

### Requirement: Messages Channel Reducer

The `StateGraph` SHALL define a `messages` channel using an `Annotation.Root()` schema with a reducer that accumulates messages across super-steps.

#### Scenario: Messages accumulate via reducer

- **WHEN** a graph node returns `{ messages: [newMessage] }`
- **THEN** the reducer appends the message to the current message list rather than replacing it

#### Scenario: Default messages channel is empty

- **WHEN** a new thread is created
- **THEN** the `messages` channel starts as an empty array

### Requirement: Thread ID from Session

The system SHALL generate and store a `threadId` in session state via `createSession()`, and pass it as `configurable: { thread_id: ... }` on every graph invocation.

#### Scenario: Session generates a threadId

- **WHEN** `createSession()` is called
- **THEN** the returned object includes a `threadId` field containing a UUID string

#### Scenario: threadId is passed to graph invocations

- **WHEN** `callReactAgent()` is called with the compiled agent
- **THEN** the graph receives `{ configurable: { thread_id: session.threadId } }` in its config

#### Scenario: Resuming a thread restores state

- **WHEN** `graph.invoke()` is called with the same `thread_id` as a previous invocation
- **THEN** the graph loads the last checkpoint for that thread and continues from it

### Requirement: Thread Enumeration

The system SHALL provide a `listThreadIds()` function that enumerates all `thread_id` values from the checkpoint database.

#### Scenario: listThreadIds returns thread IDs

- **WHEN** `listThreadIds(saver)` is called with an initialized `SqliteSaver`
- **THEN** the function returns an array of unique `thread_id` strings from existing checkpoints

#### Scenario: listThreadIds returns empty for fresh database

- **WHEN** `listThreadIds(saver)` is called on a database with no checkpoints
- **THEN** the function returns an empty array

### Requirement: Backward-Compatible Agent Interface

The `createReactAgent()` and `callReactAgent()` functions SHALL maintain their existing signatures and return types while internally using the checkpointed graph.

#### Scenario: createReactAgent returns a compiled graph

- **WHEN** `createReactAgent(model, tools)` is called
- **THEN** the system returns a compiled graph compatible with `agent.invoke()` and `agent.streamEvents()`

#### Scenario: callReactAgent returns content object

- **WHEN** `callReactAgent(agent, message, systemPrompt)` is called
- **THEN** the function returns `{ content: string }` with the agent's final text response

#### Scenario: Streaming callback receives events

- **WHEN** `callReactAgent(agent, message, systemPrompt, callback)` is called with a callback
- **THEN** the callback receives typed events (`text`, `tool_start`, `tool_end`, `tool_error`)

### Requirement: SQLite Database in Memory Directory

The SQLite database file SHALL be created in a gitignored directory by default (`memory/checkpoints.db`).

#### Scenario: Default path is within memory/

- **WHEN** no `sqlite.path` is configured and the env var `SQLITE_PATH` is unset
- **THEN** the database is created at `memory/checkpoints.db`

#### Scenario: SQLITE_PATH env var overrides config

- **WHEN** the environment variable `SQLITE_PATH` is set
- **THEN** the `SqliteSaver` uses the env var value instead of the config value
