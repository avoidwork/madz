# code-search Specification

## Purpose
TBD - created by archiving change sqlite-vec-code-search. Update Purpose after archive.
## Requirements
### Requirement: codeSearch tool accepts natural language query
The system SHALL provide a `codeSearch` tool that accepts a natural language query string and optional parameters.

#### Scenario: Basic query with default parameters
- **WHEN** a user invokes `codeSearch` with a query string
- **THEN** the tool embeds the query using the configured embedding provider
- **AND** returns the top 5 most similar code chunks by default

#### Scenario: Query with custom top-K and file filter
- **WHEN** a user invokes `codeSearch` with a query string, `topK: 10`, and `fileFilter: "src/tools/*.js"`
- **THEN** the tool returns up to 10 results filtered to files matching the glob pattern

### Requirement: codeSearch tool returns structured results
The system SHALL return results with file path, line range, content snippet, and similarity distance.

#### Scenario: Results include metadata
- **WHEN** a codeSearch query returns results
- **THEN** each result includes `file_path`, `line_start`, `line_end`, `content`, and `distance`
- **AND** results are formatted as a readable string with file locations and similarity scores

### Requirement: codeSearch tool handles empty index gracefully
The system SHALL return a clear message when no chunks have been indexed.

#### Scenario: Query with empty index
- **WHEN** codeSearch is invoked but no code has been indexed yet
- **THEN** the tool returns a message indicating the index is empty and suggesting the user run indexing first

