# embedding Specification

## Purpose
TBD - created by archiving change sqlite-vec-code-search. Update Purpose after archive.
## Requirements
### Requirement: Embedder provides local inference via transformers.js
The system SHALL use `@xenova/transformers` with `Xenova/all-MiniLM-L6-v2` as the primary embedding provider, producing 384-dimensional vectors entirely in-process.

#### Scenario: Local embedding returns Float32Array
- **WHEN** a text string is passed to the local embedder
- **THEN** a Float32Array of length 384 is returned
- **AND** no external API calls are made

#### Scenario: Model is loaded lazily on first use
- **WHEN** the embedder is created but not yet used
- **THEN** no model is loaded into memory
- **AND** the model is loaded only when `embed()` is first called

### Requirement: Embedder falls back to OpenAI API
The system SHALL fall back to OpenAI `text-embedding-3-small` when the local transformers.js model is unavailable or fails to load.

#### Scenario: Fallback on model load failure
- **WHEN** the transformers.js pipeline fails to initialize
- **THEN** the embedder falls back to OpenAI embeddings API
- **AND** returns a Float32Array of length 1536 (OpenAI dimension)

#### Scenario: Fallback on embedding failure
- **WHEN** the local model exists but `embed()` throws an error
- **THEN** the embedder retries with OpenAI embeddings API
- **AND** returns the result from OpenAI

### Requirement: Embedder handles batch embedding
The system SHALL accept an array of text strings and return an array of Float32Array embeddings.

#### Scenario: Batch embedding
- **WHEN** an array of 3 text strings is passed to `embed()`
- **THEN** an array of 3 Float32Array embeddings is returned
- **AND** each embedding has the same dimensionality

