# Spec Delta

## ADDED Requirements

### Requirement: textToSpeech returns structured error on filesystem write failure
The `textToSpeech` tool SHALL return a native structured object `{ ok: false, error }` when saving the audio to disk fails (e.g., `mkdir` or `writeFile` throws), rather than propagating the error out of the async function.

#### Scenario: Filesystem write failure returns error object
- **WHEN** the tool successfully synthesizes audio but the `mkdir` or `writeFile` call to save the file fails
- **THEN** it returns `{ ok: false, error: <descriptive message> }` and does not throw

### Requirement: textToSpeech validates speed as a finite number
The `textToSpeech` tool SHALL validate that `speed` is a finite number before calling the TTS API, and SHALL return a structured `{ ok: false, error }` if it is not.

#### Scenario: Non-numeric speed returns error object
- **WHEN** the tool is called directly with a non-numeric `speed` value
- **THEN** it returns `{ ok: false, error: <descriptive message> }` instead of serializing `null` in the request body

### Requirement: textToSpeech enforces maxWriteSize on audio buffer
The `textToSpeech` tool SHALL check the synthesized audio buffer length against `config.sandbox.maxWriteSize` before writing, and SHALL return a structured `{ ok: false, error }` if the buffer exceeds the limit.

#### Scenario: Oversized audio buffer returns error object
- **WHEN** the synthesized audio buffer length exceeds `config.sandbox.maxWriteSize`
- **THEN** it returns `{ ok: false, error: <descriptive message> }` and does not write the file

### Requirement: textToSpeech exposes configurable timeout
The `textToSpeech` tool SHALL allow the TTS API request timeout to be configured, defaulting to 15000ms when not specified.

#### Scenario: Configurable timeout is honored
- **WHEN** a `timeout` value is provided to the tool
- **THEN** the TTS API request uses that timeout instead of the hardcoded 15s default

### Requirement: textToSpeech validates output path against sandbox allowlist
The `textToSpeech` tool SHALL validate the resolved output path against the sandbox allowlist before writing, and SHALL return a structured `{ ok: false, error }` if the path is outside the sandbox scope.

#### Scenario: Output path outside sandbox returns error object
- **WHEN** the resolved output path is not within the configured sandbox allowlist
- **THEN** it returns `{ ok: false, error: <descriptive message> }` and does not write the file

### Requirement: textToSpeech schema exposes openaiApiKey field
The `textToSpeech` tool schema SHALL expose an optional `openaiApiKey` field, consistent with the `generateImage` tool.

#### Scenario: Schema accepts openaiApiKey
- **WHEN** the tool schema is inspected
- **THEN** it includes an optional `openaiApiKey` string field
