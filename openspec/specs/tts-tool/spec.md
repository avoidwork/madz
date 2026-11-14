# tts-tool Specification

## Purpose
Defines the behavior of the `textToSpeech` tool, which converts text to speech via OpenAI TTS, saves the audio to `config.memory.toolsDir`, and returns a structured result object.

## Requirements

### Requirement: textToSpeech returns native structured object on success
The `textToSpeech` tool SHALL return a native structured object `{ ok: true, path, model, voice }` on success, where `path` is a `MEDIA:`-prefixed path to the saved audio file.

#### Scenario: Successful synthesis returns structured object
- **WHEN** the tool successfully synthesizes audio for valid text, model, and voice
- **THEN** it returns `{ ok: true, path: "MEDIA:<filePath>", model, voice }` as a native object

#### Scenario: Success path includes model and voice
- **WHEN** the tool succeeds with a given model and voice
- **THEN** the returned object includes the `model` and `voice` fields matching the request

### Requirement: textToSpeech returns native structured object on failure
The `textToSpeech` tool SHALL return a native structured object `{ ok: false, error }` on failure, with a descriptive error message.

#### Scenario: Missing text returns error object
- **WHEN** the tool is called without text or with empty text
- **THEN** it returns `{ ok: false, error: "Text is required and must be a non-empty string" }`

#### Scenario: Text too long returns error object
- **WHEN** the text exceeds 4096 characters
- **THEN** it returns `{ ok: false, error: "Text must be 4096 characters or fewer" }`

#### Scenario: Missing API key returns error object
- **WHEN** no API key is available from options or config
- **THEN** it returns `{ ok: false, error: "OPENAI_API_KEY is required for text-to-speech" }`

#### Scenario: Invalid model returns error object
- **WHEN** the model is not in the supported list
- **THEN** it returns `{ ok: false, error: "Invalid model: ..." }`

#### Scenario: Invalid voice returns error object
- **WHEN** the voice is not in the supported list
- **THEN** it returns `{ ok: false, error: "Invalid voice: ..." }`

#### Scenario: API failure returns error object
- **WHEN** the OpenAI TTS API returns a non-OK response or a network error occurs
- **THEN** it returns `{ ok: false, error: <descriptive message> }`

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
