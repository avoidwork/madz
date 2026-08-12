# pptx-extraction Specification

## Purpose
TBD - created by archiving change file-format-extraction-tools. Update Purpose after archive.
## Requirements
### Requirement: PPTX to markdown conversion
The system SHALL convert `.pptx` files to structured markdown, preserving slide titles, bullet points, speaker notes, and basic text content.

#### Scenario: Extract slide titles from pptx
- **WHEN** a pptx file with slide titles is provided
- **THEN** the system outputs markdown headings (`#`) for each slide title

#### Scenario: Extract bullet points from pptx
- **WHEN** a pptx file with bullet points is provided
- **THEN** the system outputs markdown unordered list items (`-`) for each bullet

#### Scenario: Extract speaker notes from pptx
- **WHEN** a pptx file with speaker notes is provided
- **THEN** the system outputs markdown text prefixed with "Speaker Notes:"

#### Scenario: Handle slides without titles
- **WHEN** a pptx slide has no title text
- **THEN** the system outputs a numbered slide separator (e.g., `---`)

#### Scenario: Handle empty pptx file
- **WHEN** an empty pptx file is provided
- **THEN** the system returns an empty string

#### Scenario: Handle missing slide files
- **WHEN** a pptx file with missing slide XML is provided
- **THEN** the system skips the missing slide and continues processing remaining slides

