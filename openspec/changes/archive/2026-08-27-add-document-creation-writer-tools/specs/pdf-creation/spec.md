# pdf-creation Specification

## Purpose
Define the requirements for generating PDF files from markdown or HTML content within the madz agent.

## Requirements

### Requirement: Generate PDF from markdown content
The system SHALL accept a markdown string and produce a valid `.pdf` file with proper typography and formatting.

#### Scenario: Convert markdown headings to PDF
- **WHEN** markdown content with heading markers is provided
- **THEN** the system outputs a PDF file with properly sized and styled headings

#### Scenario: Convert markdown paragraphs to PDF
- **WHEN** markdown content with body text is provided
- **THEN** the system outputs a PDF file with properly formatted paragraphs

#### Scenario: Convert markdown lists to PDF
- **WHEN** markdown content with ordered or unordered lists is provided
- **THEN** the system outputs a PDF file with matching list formatting

#### Scenario: Convert inline formatting to PDF
- **WHEN** markdown content with bold, italic, and code markers is provided
- **THEN** the system outputs a PDF file with matching inline formatting

### Requirement: Generate PDF from HTML content
The system SHALL accept an HTML string and produce a valid `.pdf` file.

#### Scenario: Convert HTML to PDF
- **WHEN** an HTML string is provided
- **THEN** the system outputs a PDF file rendering the HTML content

### Requirement: Generate PDF with metadata
The system SHALL accept optional metadata (title, author, subject) and include it in the PDF.

#### Scenario: Include PDF metadata
- **WHEN** metadata options are provided with the content
- **THEN** the system outputs a PDF file with the specified title, author, and subject metadata

### Requirement: Tool output format
The system SHALL return `{ filePath, format, size }` on successful creation.

#### Scenario: Return file metadata
- **WHEN** a PDF file is successfully created
- **THEN** the system returns an object with `filePath` (absolute path), `format` ("pdf"), and `size` (file size in bytes)