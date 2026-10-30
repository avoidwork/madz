# Spec Delta

## Purpose

Defines the behavior of the `textToSpeech` tool, which converts text to speech via OpenAI TTS, saves the audio to `config.memory.toolsDir`, and returns a structured result object.

## ADDED Requirements

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
