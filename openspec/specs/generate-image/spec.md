# generate-image Specification

## Purpose
Provides the `generateImage` tool that generates an image from a text prompt via FAL.ai and returns a structured `{ ok, imageUrl?, error? }` result so callers can inspect success and failure without parsing a string.

## Requirements

### Requirement: Generate image returns structured success object
The system SHALL return a native structured object `{ ok: true, imageUrl }` from the `generateImage` tool on success, where `imageUrl` is the public URL of the generated image. The result SHALL NOT be wrapped in a `JSON.stringify` string.

#### Scenario: Successful generation returns native object
- **WHEN** the `generateImage` tool is invoked with a valid prompt and a valid API key
- **THEN** it returns `{ ok: true, imageUrl }` as a native object, not a stringified JSON string

### Requirement: Generate image returns structured error object
The system SHALL return a native structured object `{ ok: false, error }` from the `generateImage` tool on any failure, where `error` is a descriptive message. The result SHALL NOT be wrapped in a `JSON.stringify` string.

#### Scenario: Missing prompt returns structured error
- **WHEN** the `generateImage` tool is invoked without a non-empty prompt
- **THEN** it returns `{ ok: false, error }` with a message that the prompt is required

#### Scenario: Prompt too long returns structured error
- **WHEN** the `generateImage` tool is invoked with a prompt longer than 1000 characters
- **THEN** it returns `{ ok: false, error }` with a message that the prompt is too long

#### Scenario: Missing API key returns structured error
- **WHEN** the `generateImage` tool is invoked without a configured FAL API key
- **THEN** it returns `{ ok: false, error }` with a message that the API key is required

#### Scenario: FAL error returns structured error
- **WHEN** the `generateImage` tool's FAL.ai request fails
- **THEN** it returns `{ ok: false, error }` with a descriptive message

### Requirement: FAL API key resolved server-side
The system SHALL resolve the FAL API key server-side from config/env and inject it into the `generateImage` tool's runtime options, so the secret never passes through the model's context or the transcript.

#### Scenario: Key not passed by the model
- **WHEN** the `generateImage` tool is invoked
- **THEN** the model supplies only `prompt` (and optional `timeout`); the FAL API key is resolved server-side
