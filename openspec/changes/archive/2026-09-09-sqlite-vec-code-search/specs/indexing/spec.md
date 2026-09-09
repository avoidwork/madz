## ADDED Requirements

### Requirement: Indexer scans project source files
The system SHALL scan project source files recursively, discovering files with recognized extensions (.js, .mjs, .cjs, .json, .yaml, .yml, .md, .html, .css).

#### Scenario: Scan discovers source files
- **WHEN** the indexer scans the project root
- **THEN** it returns a list of file paths matching recognized extensions
- **AND** it excludes node_modules, .git, .worktrees, and other configured ignore directories

### Requirement: Indexer tracks file mtimes
The system SHALL track the modification time (mtime) of each indexed file and skip files whose mtime has not changed since last index.

#### Scenario: Unchanged file is skipped
- **WHEN** the indexer runs a second time on a project with no file changes
- **THEN** no files are re-embedded
- **AND** the indexer reports that all files are up to date

#### Scenario: Changed file is re-indexed
- **WHEN** a file's mtime is newer than the stored mtime
- **THEN** the file is re-chunked and re-embedded
- **AND** old chunks for that file are replaced via upsert

### Requirement: Indexer provides progress reporting
The system SHALL report progress during indexing, indicating which file is being processed and the total count.

#### Scenario: Progress output during indexing
- **WHEN** the indexer is processing files
- **THEN** it outputs progress messages like `[3/42] src/vector/store.js`
