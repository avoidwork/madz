# Spec Delta

## MODIFIED Requirements

### Requirement: indexCode dispatches indexing to a Piscina worker pool
The system SHALL run the `indexCode` tool's indexing work in a Piscina worker pool rather than inline on the main event loop.

#### Scenario: indexCode dispatches project config to the pool
- **WHEN** the `indexCode` tool is invoked with a configured project
- **THEN** it dispatches the project's plain config (dbPath, rootDir, include, exclude, chunkSize, chunkOverlap, maxFileSize, force) to a Piscina pool
- **AND** it awaits the pool's result

#### Scenario: indexCode returns formatted indexing results
- **WHEN** the pool returns a successful result
- **THEN** the tool returns a structured object `{ ok: true, results }` where `results` is an array of per-project objects `{ name, indexed, skipped, errors }`

#### Scenario: indexCode handles pool errors gracefully
- **WHEN** the pool rejects with an error
- **THEN** the tool returns a per-project entry `{ name, error }` within the `results` array
- **AND** the overall result is still `{ ok: true, results }` so partial failures are reported per project

#### Scenario: indexCode handles no configured projects
- **WHEN** the `indexCode` tool is invoked but no vector projects are configured
- **THEN** the tool returns a structured object `{ ok: false, error }` indicating no projects are configured
