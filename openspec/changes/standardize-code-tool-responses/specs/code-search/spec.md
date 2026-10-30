# Spec Delta

## MODIFIED Requirements

### Requirement: codeSearch tool returns structured results
The system SHALL return results with file path, line range, content snippet, similarity distance (vector mode), rank (fulltext mode), or both (hybrid mode).

#### Scenario: Results include metadata
- **WHEN** a codeSearch query returns results
- **THEN** each result includes `file_path`, `line_start`, `line_end`, `content`
- **AND** in `vector` mode, includes `distance`
- **AND** in `fulltext` mode, includes `rank`
- **AND** in `hybrid` mode, includes `distance`, `rank`, and `source` annotation
- **AND** the tool returns a structured object `{ ok: true, results, count }` where `results` is an array of result objects and `count` is the number of results

#### Scenario: Search failure returns structured error
- **WHEN** a codeSearch query fails (unknown project, store open failure, embed failure, search failure)
- **THEN** the tool returns a structured object `{ ok: false, error }` describing the failure

### Requirement: codeSearch tool handles empty index gracefully
The system SHALL return a clear message when no chunks have been indexed.

#### Scenario: Query with empty index
- **WHEN** codeSearch is invoked but no code has been indexed yet
- **THEN** the tool returns a structured object `{ ok: false, error }` indicating the index is empty and suggesting the user run indexing first
