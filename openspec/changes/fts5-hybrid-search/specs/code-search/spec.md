## MODIFIED Requirements

### Requirement: codeSearch tool accepts natural language query
The system SHALL provide a `codeSearch` tool that accepts a natural language query string and optional parameters including a `mode` parameter.

#### Scenario: Basic query with default parameters
- **WHEN** a user invokes `codeSearch` with a query string
- **THEN** the tool embeds the query using the configured embedding provider
- **AND** returns the top 5 most similar code chunks by default
- **AND** the mode defaults to `vector` for backward compatibility

#### Scenario: Query with custom top-K and file filter
- **WHEN** a user invokes `codeSearch` with a query string, `topK: 10`, and `fileFilter: "src/tools/*.js"`
- **THEN** the tool returns up to 10 results filtered to files matching the glob pattern

#### Scenario: Query in fulltext mode
- **WHEN** a user invokes `codeSearch` with `mode: "fulltext"` and a query string
- **THEN** the tool passes the query directly to FTS5 MATCH
- **AND** returns results ranked by FTS5 relevance

#### Scenario: Query in hybrid mode
- **WHEN** a user invokes `codeSearch` with `mode: "hybrid"` and a query string
- **THEN** the tool runs both vector and FTS searches
- **AND** returns merged results via RRF

### Requirement: codeSearch tool returns structured results
The system SHALL return results with file path, line range, content snippet, similarity distance (vector mode), rank (fulltext mode), or both (hybrid mode).

#### Scenario: Results include metadata
- **WHEN** a codeSearch query returns results
- **THEN** each result includes `file_path`, `line_start`, `line_end`, `content`
- **AND** in `vector` mode, includes `distance`
- **AND** in `fulltext` mode, includes `rank`
- **AND** in `hybrid` mode, includes `distance`, `rank`, and `source` annotation
- **AND** results are formatted as a readable string with file locations and scores
