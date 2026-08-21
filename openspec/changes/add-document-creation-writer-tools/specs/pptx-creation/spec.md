# pptx-creation Specification

## Purpose
Define the requirements for creating PPTX files from structured slide content within the madz agent.

## Requirements

### Requirement: Create PPTX from slide definitions
The system SHALL accept an array of slide definitions and produce a valid `.pptx` file.

#### Scenario: Create presentation with title slides
- **WHEN** an array of slide objects with `layout: "title"` and `title`/`subtitle` fields is provided
- **THEN** the system outputs a PPTX file with properly formatted title slides

#### Scenario: Create presentation with bullet slides
- **WHEN** an array of slide objects with `layout: "bullet"` and `title`/`bulletPoints` fields is provided
- **THEN** the system outputs a PPTX file with title and bulleted list content

#### Scenario: Create presentation with content slides
- **WHEN** an array of slide objects with `layout: "content"` and `title`/`content` fields is provided
- **THEN** the system outputs a PPTX file with title and body text content

### Requirement: Create PPTX with image placeholders
The system SHALL accept slide definitions with image references and produce a PPTX file with embedded images.

#### Scenario: Create slide with image
- **WHEN** a slide object includes an `image` field with a valid file path
- **THEN** the system outputs a PPTX file with the image embedded on the slide

### Requirement: Tool output format
The system SHALL return `{ filePath, format, size }` on successful creation.

#### Scenario: Return file metadata
- **WHEN** a PPTX file is successfully created
- **THEN** the system returns an object with `filePath` (absolute path), `format` ("pptx"), and `size` (file size in bytes)