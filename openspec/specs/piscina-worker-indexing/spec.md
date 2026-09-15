# piscina-worker-indexing Specification

## Purpose
TBD - created by archiving change piscina-worker-indexing. Update Purpose after archive.
## Requirements
### Requirement: indexCode dispatches indexing to a Piscina worker pool

The system SHALL run the `indexCode` tool's indexing work in a Piscina worker pool rather than inline on the main event loop.

#### Scenario: indexCode dispatches project config to the pool

- **WHEN** the `indexCode` tool is invoked with a configured project
- **THEN** it dispatches the project's plain config (dbPath, rootDir, include, exclude, chunkSize, chunkOverlap, maxFileSize, force) to a Piscina pool
- **AND** it awaits the pool's result

#### Scenario: indexCode returns formatted indexing results

- **WHEN** the pool returns a successful result
- **THEN** the tool returns `${name}: ${indexed} indexed, ${skipped} skipped, ${errors} errors`

#### Scenario: indexCode handles pool errors gracefully

- **WHEN** the pool rejects with an error
- **THEN** the tool returns `${name}: error — ${err.message}`

### Requirement: Worker entry file creates store and embedder internally

The system SHALL provide a worker entry file that accepts plain project config and creates the vector store and embedder internally before calling `reindex`.

#### Scenario: Worker creates store and embedder from config

- **WHEN** the worker receives a plain config object
- **THEN** it creates the vector store via `createVectorStore(dbPath, { fulltext, ftsTokenize })`
- **AND** it creates the embedder via `createEmbedder({ model })`
- **AND** it calls `reindex(store, embedder, { rootDir, include, exclude, chunkSize, chunkOverlap, maxFileSize, force })`
- **AND** it returns the `{ indexed, skipped, errors }` result

