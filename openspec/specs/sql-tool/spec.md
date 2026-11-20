# sql-tool Specification

## Purpose
Provides running parameterized SQL queries against Postgres, SQLite, and MySQL databases, with sandbox allowlist enforcement on SQLite file paths.

## Requirements

### Requirement: SQL query execution
The system SHALL execute a parameterized SQL query against a configured relational database (Postgres, SQLite, or MySQL).

#### Scenario: Run a SELECT query against Postgres
- **WHEN** a user provides a SELECT query with parameters for a Postgres database
- **THEN** the system executes the query and returns the resulting rows

#### Scenario: Run a SELECT query against SQLite
- **WHEN** a user provides a SELECT query with parameters for a SQLite database
- **THEN** the system executes the query and returns the resulting rows

#### Scenario: Run a SELECT query against MySQL
- **WHEN** a user provides a SELECT query with parameters for a MySQL database
- **THEN** the system executes the query and returns the resulting rows

### Requirement: Parameterized queries
The system SHALL use parameterized queries (bound parameters / prepared statements) for all database operations, never string-concatenating user input into SQL.

#### Scenario: Parameters are bound
- **WHEN** a user provides a query with placeholders and a params array
- **THEN** the system binds the parameters to the placeholders and executes the query safely

### Requirement: Input validation
The system SHALL validate all SQL tool input against a Zod schema before processing, rejecting unsupported drivers and invalid input.

#### Scenario: Unsupported driver is rejected
- **WHEN** a user requests a driver other than postgres, sqlite, or mysql
- **THEN** the system returns an error indicating the driver is unsupported

#### Scenario: Missing query is rejected
- **WHEN** a user provides no query
- **THEN** the system returns an error indicating the query is required

### Requirement: SQLite path enforcement
The system SHALL enforce the sandbox allowlist on SQLite file paths.

#### Scenario: SQLite path outside allowlist is rejected
- **WHEN** a user provides a SQLite file path outside the sandbox allowlist
- **THEN** the system returns an access-denied error

### Requirement: Config-driven connection sourcing
The system SHALL source SQL connection details from server-side config (`config.sql[driver]`), never from model input.

#### Scenario: Connection from config
- **WHEN** the `sql` tool is invoked with a driver and query
- **THEN** the connection is resolved from `config.sql[driver]` and the model supplies only driver, query, and params

#### Scenario: Connection env vars map without vendor prefix
- **WHEN** `POSTGRES_HOST` is set
- **THEN** it maps to `sql.postgres.host` (the `sql` container key is dropped from the env-var name)
