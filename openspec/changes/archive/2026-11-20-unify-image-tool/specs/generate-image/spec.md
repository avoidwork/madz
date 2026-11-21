# Spec Delta

## MODIFIED Requirements

### Requirement: Generate image returns structured success object
The system SHALL return a native structured object `{ ok: true, imageUrl }` from the `image` tool's `generate` action on success, where `imageUrl` is the public URL of the generated image. The result SHALL NOT be wrapped in a `JSON.stringify` string.

#### Scenario: Successful generation returns native object
- **WHEN** the `image` tool's `generate` action is invoked with a valid prompt and a valid API key
- **THEN** it returns `{ ok: true, imageUrl }` as a native object, not a stringified JSON string

### Requirement: Generate image returns structured error object
The system SHALL return a native structured object `{ ok: false, error }` from the `image` tool's `generate` action on any failure, where `error` is a descriptive message. The result SHALL NOT be wrapped in a `JSON.stringify` string.

#### Scenario: Missing prompt returns structured error
- **WHEN** the `image` tool's `generate` action is invoked without a non-empty prompt
- **THEN** it returns `{ ok: false, error }` with a message that the prompt is required

#### Scenario: Prompt too long returns structured error
- **WHEN** the `image` tool's `generate` action is invoked with a prompt longer than 1000 characters
- **THEN** it returns `{ ok: false, error }` with a message that the prompt is too long

#### Scenario: Missing API key returns structured error
- **WHEN** the `image` tool's `generate` action is invoked without a configured FAL API key
- **THEN** it returns `{ ok: false, error }` with a message that the API key is required

#### Scenario: FAL error returns structured error
- **WHEN** the FAL.ai API call fails during the `generate` action
- **THEN** it returns `{ ok: false, error }` with the FAL error message
