# docx-creation Specification

## Purpose
Define the requirements for creating DOCX files from structured content within the madz agent.

## Requirements

### Requirement: Create DOCX from markdown content
The system SHALL accept a markdown string and produce a valid `.docx` file with proper heading hierarchy, paragraph formatting, and list structure.

#### Scenario: Convert headings to DOCX
- **WHEN** markdown content with `#`, `##`, `###` heading markers is provided
- **THEN** the system outputs a DOCX file with matching heading styles (Heading 1, Heading 2, Heading 3)

#### Scenario: Convert paragraphs to DOCX
- **WHEN** markdown content with body text paragraphs is provided
- **THEN** the system outputs a DOCX file with properly formatted paragraphs

#### Scenario: Convert lists to DOCX
- **WHEN** markdown content with ordered or unordered lists is provided
- **THEN** the system outputs a DOCX file with matching list formatting

#### Scenario: Convert inline formatting to DOCX
- **WHEN** markdown content with bold (`**text**`), italic (`*text*`), and code (`code`) markers is provided
- **THEN** the system outputs a DOCX file with matching inline formatting

#### Scenario: Handle empty content
- **WHEN** an empty string or null content is provided
- **THEN** the system returns an error with a descriptive message

### Requirement: Create DOCX from structured JSON
The system SHALL accept a structured JSON object with headings, paragraphs, and tables, and produce a valid `.docx` file.

#### Scenario: Create document with headings and paragraphs
- **WHEN** a JSON object with `headings` and `paragraphs` arrays is provided
- **THEN** the system outputs a DOCX file with those headings and paragraphs in order

#### Scenario: Create document with tables
- **WHEN** a JSON object with a `tables` array is provided
- **THEN** the system outputs a DOCX file with properly formatted tables

### Requirement: Tool output format
The system SHALL return `{ filePath, format, size }` on successful creation.

#### Scenario: Return file metadata
- **WHEN** a DOCX file is successfully created
- **THEN** the system returns an object with `filePath` (absolute path), `format` ("docx"), and `size` (file size in bytes)