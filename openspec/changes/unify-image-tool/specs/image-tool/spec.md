# Spec Delta

## Purpose

Provides a unified `image` tool that dispatches on an `action` enum (`read`, `resize`, `metadata`, `convert`, `generate`) so the harness exposes a single image tool covering reading, resizing, metadata extraction, format conversion, and FAL.ai generation.

## ADDED Requirements

### Requirement: Single image tool dispatches on action enum
The system SHALL provide a single `image` tool that dispatches on a required `action` enum with values `read`, `resize`, `metadata`, `convert`, and `generate`. There SHALL be only one image tool; the retired `readImage` and `generateImage` tools SHALL NOT be registered.

#### Scenario: Tool exposes action enum
- **WHEN** the `image` tool is invoked
- **THEN** it requires an `action` field that is one of `read`, `resize`, `metadata`, `convert`, or `generate`

#### Scenario: Only one image tool registered
- **WHEN** the tool registry is built
- **THEN** the `image` tool is the only image tool registered, and `readImage`/`generateImage` are not present

### Requirement: Read action returns image_url content block
The system SHALL, for the `image` tool's `read` action, read an image file from disk and return a base64 data-URI `image_url` content block for LLM vision analysis, downscaling images wider or taller than the configured `image.maxDimension` while preserving aspect ratio and never enlarging.

#### Scenario: Successful read returns image_url block
- **WHEN** the `image` tool's `read` action is invoked with a valid path to an existing image file within the sandbox allowlist
- **THEN** it returns an `image_url` content block whose URL is a `data:<mime>;base64,<data>` data URI

#### Scenario: Downscale preserves aspect ratio
- **WHEN** the `image` tool's `read` action reads an image wider or taller than `image.maxDimension`
- **THEN** it returns the image downscaled so neither dimension exceeds `image.maxDimension`, preserving aspect ratio

#### Scenario: Missing file returns error
- **WHEN** the `image` tool's `read` action is invoked with a path to a file that does not exist
- **THEN** it returns `{ ok: false, error }` with a clear "file not found" message

#### Scenario: Path outside sandbox scope returns error
- **WHEN** the `image` tool's `read` action is invoked with a path outside the sandbox allowlist
- **THEN** it returns `{ ok: false, error }` indicating access is denied

### Requirement: Resize action preserves aspect ratio
The system SHALL, for the `image` tool's `resize` action, resize an image to a target width and/or height (or a max dimension) preserving aspect ratio and never enlarging.

#### Scenario: Resize to target dimensions
- **WHEN** the `image` tool's `resize` action is invoked with a source path and a target width and/or height
- **THEN** it resizes the image preserving aspect ratio and writes the result to the target path

#### Scenario: Resize to max dimension
- **WHEN** the `image` tool's `resize` action is invoked with a max dimension
- **THEN** it resizes the image so neither dimension exceeds the max dimension, preserving aspect ratio

### Requirement: Metadata action returns image metadata
The system SHALL, for the `image` tool's `metadata` action, return image metadata (including width, height, and format) via sharp.

#### Scenario: Metadata returned
- **WHEN** the `image` tool's `metadata` action is invoked with a valid image path
- **THEN** it returns `{ ok: true, metadata }` where `metadata` includes width, height, and format

#### Scenario: Invalid image returns error
- **WHEN** the `image` tool's `metadata` action is invoked with a path to an undecodable image
- **THEN** it returns `{ ok: false, error }` with a descriptive message

### Requirement: Convert action converts image format
The system SHALL, for the `image` tool's `convert` action, convert an image to a target format (e.g., png, jpeg, webp) and write the result to a target path.

#### Scenario: Convert to target format
- **WHEN** the `image` tool's `convert` action is invoked with a source path, a target format, and an output path
- **THEN** it converts the image to the target format and writes the result to the output path

#### Scenario: Invalid format returns error
- **WHEN** the `image` tool's `convert` action is invoked with an unsupported target format
- **THEN** it returns `{ ok: false, error }` with a descriptive message

### Requirement: Generate action returns structured result
The system SHALL, for the `image` tool's `generate` action, generate an image from a text prompt via FAL.ai (FLUX Klein) and return a native structured object `{ ok: true, imageUrl }` on success or `{ ok: false, error }` on failure.

#### Scenario: Successful generation returns native object
- **WHEN** the `image` tool's `generate` action is invoked with a valid prompt and a valid FAL API key
- **THEN** it returns `{ ok: true, imageUrl }` as a native object, not a stringified JSON string

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
