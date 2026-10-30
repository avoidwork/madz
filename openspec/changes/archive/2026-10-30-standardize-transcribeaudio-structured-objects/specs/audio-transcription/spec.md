# Spec Delta

## MODIFIED Requirements

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
