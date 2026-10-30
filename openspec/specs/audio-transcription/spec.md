# audio-transcription Specification

## Purpose
TBD - created by archiving change audio-transcription-tool. Update Purpose after archive.

## Requirements

### Requirement: Transcribe audio file to text
The system SHALL provide a `transcribeAudio` tool that converts an audio file to text, returning a native structured object `{ ok: true, text, model, backend }` on success and `{ ok: false, error }` on failure.

#### Scenario: Successful transcription via API
- **WHEN** the tool is invoked with a valid path to an existing audio file within the sandbox allowlist and `openaiApiKey` is configured
- **THEN** it calls the OpenAI `audio/transcriptions` endpoint and returns `{ ok: true, text, model, backend: "api" }`

#### Scenario: Successful transcription via local Whisper
- **WHEN** the tool is invoked with a valid path to an existing audio file within the sandbox allowlist and no `openaiApiKey` is configured
- **THEN** it runs the local Whisper pipeline and returns `{ ok: true, text, model, backend: "local" }`

#### Scenario: Missing file
- **WHEN** the tool is invoked with a path to a file that does not exist
- **THEN** it returns `{ ok: false, error }` with a clear "file not found" message

### Requirement: Validate path against sandbox allowlist
The system SHALL validate the requested audio path against the sandbox allowlist before reading, rejecting paths outside the allowed scope.

#### Scenario: Path outside sandbox scope
- **WHEN** the tool is invoked with a path outside the sandbox allowlist
- **THEN** it returns `{ ok: false, error }` indicating access is denied

#### Scenario: Path within sandbox scope
- **WHEN** the tool is invoked with a path within the sandbox allowlist
- **THEN** it proceeds to read the file

### Requirement: Enforce audio file size limit
The system SHALL enforce a maximum file size for audio files read by the `transcribeAudio` tool via `checkFileLimit`.

#### Scenario: File exceeds size limit
- **WHEN** the tool is invoked with a path to an audio file larger than the configured max size
- **THEN** it returns `{ ok: false, error }` indicating the file exceeds the configured max size

#### Scenario: File within size limit
- **WHEN** the tool is invoked with a path to an audio file within the configured max size
- **THEN** it reads and transcribes the file

### Requirement: Validate tool input schema
The system SHALL validate the `transcribeAudio` tool input via a Zod schema, requiring a non-empty `path` string and accepting optional `language` and `prompt` strings.

#### Scenario: Missing path
- **WHEN** the tool is invoked without a `path`
- **THEN** the Zod schema rejects the input with a validation error

#### Scenario: Invalid path type
- **WHEN** the tool is invoked with a non-string `path`
- **THEN** the Zod schema rejects the input with a validation error

### Requirement: Handle unsupported audio formats
The system SHALL reject audio files with unsupported or non-audio extensions with a clear error.

#### Scenario: Unsupported extension
- **WHEN** the tool is invoked with a path to a file with an unsupported extension
- **THEN** it returns `{ ok: false, error }` indicating the format is unsupported

### Requirement: Use async file system operations
The system SHALL perform all file system operations in the `transcribeAudio` tool using async `node:fs/promises`. Synchronous `fs.readFileSync`/`fs.statSync` SHALL NOT be used.

#### Scenario: Async file read
- **WHEN** the tool reads the audio file
- **THEN** it uses `node:fs/promises` async operations, not synchronous fs calls
