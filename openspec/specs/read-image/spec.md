# read-image Specification

## Purpose
TBD - created by archiving change read-image-tool. Update Purpose after archive.
## Requirements
### Requirement: Read image from disk
The system SHALL provide a `readImage` tool that reads a local image file from disk and returns its base64-encoded contents plus the detected MIME type, so the payload can be passed directly to an LLM for vision analysis.

#### Scenario: Successful read
- **WHEN** the tool is invoked with a valid path to an existing image file within the sandbox allowlist
- **THEN** it returns `{ ok: true, mimeType, data }` where `data` is the base64-encoded file contents and `mimeType` is the detected image MIME type

#### Scenario: Missing file
- **WHEN** the tool is invoked with a path to a file that does not exist
- **THEN** it returns `{ ok: false, error }` with a clear "file not found" message

### Requirement: Enforce image size limit
The system SHALL enforce a configurable maximum file size for images read by the `readImage` tool, controlled by the `image.maxSize` config value (default `100kb`).

#### Scenario: File exceeds size limit
- **WHEN** the tool is invoked with a path to an image file larger than `image.maxSize`
- **THEN** it returns `{ ok: false, error }` indicating the file exceeds the configured max size

#### Scenario: File within size limit
- **WHEN** the tool is invoked with a path to an image file within `image.maxSize`
- **THEN** it reads and returns the file contents

### Requirement: Validate path against sandbox allowlist
The system SHALL validate the requested image path against the sandbox allowlist before reading, rejecting paths outside the allowed scope.

#### Scenario: Path outside sandbox scope
- **WHEN** the tool is invoked with a path outside the sandbox allowlist
- **THEN** it returns `{ ok: false, error }` indicating access is denied

#### Scenario: Path within sandbox scope
- **WHEN** the tool is invoked with a path within the sandbox allowlist
- **THEN** it proceeds to read the file

### Requirement: Use async file system operations
The system SHALL perform all file system operations in the `readImage` tool using async `node:fs/promises` (e.g., `readFile`, `stat`, `access`). Synchronous `fs.readFileSync`/`fs.statSync` SHALL NOT be used.

#### Scenario: Async file read
- **WHEN** the tool reads the image file
- **THEN** it uses `node:fs/promises` async operations, not synchronous fs calls

