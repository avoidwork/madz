## ADDED Requirements

### Requirement: Create DOCX documents from markdown
The system SHALL accept markdown text input and generate a valid DOCX file with preserved formatting (headings, paragraphs, lists).

#### Scenario: Generate DOCX from markdown
- **WHEN** the agent calls createDocx with valid markdown content and a filename
- **THEN** the system returns a DOCX file path and the format "docx"

#### Scenario: Handle empty markdown content
- **WHEN** the agent calls createDocx with empty or whitespace-only markdown
- **THEN** the system throws an AppError with code 400

#### Scenario: Handle invalid filename
- **WHEN** the agent calls createDocx with a filename containing path traversal characters (../)
- **THEN** the system throws an AppError with code 400

### Requirement: Create XLSX documents from tabular data
The system SHALL accept structured tabular data (rows and columns) and generate a valid XLSX file.

#### Scenario: Generate XLSX from tabular data
- **WHEN** the agent calls createXlsx with valid rows and columns data and a filename
- **THEN** the system returns an XLSX file path and the format "xlsx"

#### Scenario: Handle empty tabular data
- **WHEN** the agent calls createXlsx with an empty rows array
- **THEN** the system throws an AppError with code 400

#### Scenario: Handle invalid filename
- **WHEN** the agent calls createXlsx with a filename containing path traversal characters
- **THEN** the system throws an AppError with code 400

### Requirement: Create PPTX documents from slide outlines
The system SHALL accept structured slide outline JSON and generate a valid PPTX file with basic layouts.

#### Scenario: Generate PPTX from slide outline
- **WHEN** the agent calls createPptx with valid slide outline JSON and a filename
- **THEN** the system returns a PPTX file path and the format "pptx"

#### Scenario: Handle empty slide outline
- **WHEN** the agent calls createPptx with an empty slides array
- **THEN** the system throws an AppError with code 400

#### Scenario: Handle invalid filename
- **WHEN** the agent calls createPptx with a filename containing path traversal characters
- **THEN** the system throws an AppError with code 400

### Requirement: Create PDF documents from markdown
The system SHALL accept markdown text input and generate a valid PDF file with preserved formatting.

#### Scenario: Generate PDF from markdown
- **WHEN** the agent calls createPdf with valid markdown content and a filename
- **THEN** the system returns a PDF file path and the format "pdf"

#### Scenario: Handle empty markdown content
- **WHEN** the agent calls createPdf with empty or whitespace-only markdown
- **THEN** the system throws an AppError with code 400

#### Scenario: Handle invalid filename
- **WHEN** the agent calls createPdf with a filename containing path traversal characters
- **THEN** the system throws an AppError with code 400