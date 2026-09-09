## ADDED Requirements

### Requirement: Chunker splits files into fixed-size blocks with overlap
The system SHALL split source files into chunks of a configurable line count with configurable overlap between consecutive chunks.

#### Scenario: Default chunking with 96-line blocks and 16-line overlap
- **WHEN** a 200-line source file is chunked with default settings (96 lines, 16 overlap)
- **THEN** three chunks are produced: lines 1-96, lines 81-176, lines 161-200
- **AND** each chunk has `file_path`, `line_start`, `line_end`, and `content` fields

#### Scenario: File smaller than chunk size
- **WHEN** a 50-line source file is chunked with default settings
- **THEN** a single chunk is produced covering lines 1-50

### Requirement: Chunker skips binary files
The system SHALL detect and skip binary files based on file extension and content inspection.

#### Scenario: Binary file is skipped
- **WHEN** a `.png` or `.jpg` file is passed to the chunker
- **THEN** the chunker returns an empty array for that file

### Requirement: Chunker skips files exceeding size limit
The system SHALL skip files larger than a configurable maximum size (default 500KB).

#### Scenario: Large file is skipped
- **WHEN** a file larger than 500KB is passed to the chunker
- **THEN** the chunker returns an empty array for that file
