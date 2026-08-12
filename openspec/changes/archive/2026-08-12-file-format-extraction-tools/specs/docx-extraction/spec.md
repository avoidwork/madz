## ADDED Requirements

### Requirement: DOCX to markdown conversion
The system SHALL convert `.docx` files to structured markdown, preserving headings, paragraphs, lists, tables, and inline formatting (bold, italic, code).

#### Scenario: Extract headings from docx
- **WHEN** a docx file with heading styles is provided
- **THEN** the system outputs markdown headings (`#`, `##`, `###`) matching the document hierarchy

#### Scenario: Extract paragraphs from docx
- **WHEN** a docx file with body text is provided
- **THEN** the system outputs markdown paragraphs with proper line breaks

#### Scenario: Extract lists from docx
- **WHEN** a docx file with ordered or unordered lists is provided
- **THEN** the system outputs markdown list items (`-` for unordered, `1.` for ordered)

#### Scenario: Extract tables from docx
- **WHEN** a docx file with tables is provided
- **THEN** the system outputs markdown tables with proper column alignment

#### Scenario: Handle empty docx file
- **WHEN** an empty docx file is provided
- **THEN** the system returns an empty string

#### Scenario: Handle missing document.xml
- **WHEN** a docx file without word/document.xml is provided
- **THEN** the system throws a descriptive error
