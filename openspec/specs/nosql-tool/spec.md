# nosql-tool Specification

## Purpose
Provides direct query execution against non-relational stores (MongoDB, Redis) with a registry/plugin architecture for engine extensibility, Zod input validation, and sandbox-aware connection handling.

## Requirements

### Requirement: NoSQL query execution

The system SHALL execute an operation against a configured non-relational store (MongoDB or Redis) through a `nosql` tool.

#### Scenario: Successful MongoDB query

- **WHEN** the agent invokes the `nosql` tool with engine `mongodb` and a valid operation
- **THEN** the tool executes the operation against the configured MongoDB store and returns the result

#### Scenario: Successful Redis query

- **WHEN** the agent invokes the `nosql` tool with engine `redis` and a valid operation
- **THEN** the tool executes the operation against the configured Redis store and returns the result

### Requirement: Engine extensibility

The system SHALL support adding new NoSQL engines without modifying the core dispatch, the base schema, or the tool registry wiring.

#### Scenario: Adding a new engine

- **WHEN** a new engine module is added to the `ENGINES` map and a new discriminated-union variant is added
- **THEN** the core dispatch and `src/tools/index.js` wiring remain unchanged

### Requirement: Input validation

The system SHALL validate all `nosql` tool input against a Zod schema before processing, rejecting unsupported engines and invalid operations.

#### Scenario: Rejecting an unsupported engine

- **WHEN** the agent invokes the `nosql` tool with an engine not in the registry
- **THEN** the tool returns an error indicating the engine is unsupported

#### Scenario: Rejecting an invalid operation

- **WHEN** the agent invokes the `nosql` tool with an operation not valid for the selected engine
- **THEN** the tool returns an error indicating the operation is invalid

### Requirement: Credential sourcing

The system SHALL source NoSQL connection credentials from environment variables only, never from hardcoded values in config files.

#### Scenario: Credentials from environment

- **WHEN** a NoSQL connection requires credentials
- **THEN** the tool resolves them from `process.env` via the config loader

### Requirement: Connection lifecycle

The system SHALL create NoSQL connections lazily on first use, reuse them across operations, and close them on shutdown.

#### Scenario: Lazy connection creation

- **WHEN** the `nosql` tool is first invoked for an engine
- **THEN** the engine creates its client connection at that point, not at module import

#### Scenario: Connection close on shutdown

- **WHEN** the tool is shut down
- **THEN** all open engine connections are closed

### Requirement: Timeout discipline

The system SHALL enforce a timeout on every NoSQL operation.

#### Scenario: Operation timeout

- **WHEN** a NoSQL operation exceeds the configured timeout
- **THEN** the operation is aborted and an error is returned

### Requirement: Config-driven connection sourcing
The system SHALL source NoSQL connection details from server-side config (`config.nosql[engine]`), never from model input.

#### Scenario: Connection from config
- **WHEN** the `nosql` tool is invoked with an engine and operation
- **THEN** the connection is resolved from `config.nosql[engine]` and the model supplies only engine and operation

#### Scenario: Connection env vars map without vendor prefix
- **WHEN** `MONGODB_CONNECTION_STRING` is set
- **THEN** it maps to `nosql.mongodb.connectionString` (the `nosql` container key is dropped from the env-var name)
