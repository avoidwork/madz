# image-tool Specification

## Purpose
Provides a local `image` tool that dispatches on an `action` enum (`read`, `resize`, `metadata`, `convert`) so the harness exposes a single local image tool covering reading, resizing, metadata extraction, and format conversion. Image generation from a text prompt is provided by the separate `generateImage` tool, which carries the `network:outbound` permission and the FAL API key.

## Requirements

### Requirement: Single local image tool dispatches on action enum
The system SHALL provide a single `image` tool that dispatches on a required `action` enum with values `read`, `resize`, `metadata`, and `convert`. The retired `readImage` tool SHALL NOT be registered. Image generation is provided by the separate `generateImage` tool, not by the `image` tool.

#### Scenario: Tool exposes action enum
- **WHEN** the `image` tool is invoked
- **THEN** it requires an `action` field that is one of `read`, `resize`, `metadata`, or `convert`

#### Scenario: Only one local image tool registered
- **WHEN** the tool registry is built
- **THEN** the `image` tool is the only local image tool registered, and `readImage` is not present

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

### Requirement: Per-action schema validation
The system SHALL validate the `image` tool's input per action, requiring the fields each action needs and rejecting fields that only apply to a different action.

#### Scenario: Resize requires path, output, and a dimension
- **WHEN** the `image` tool's `resize` action is invoked without a path, output, or dimension
- **THEN** schema validation fails with a descriptive error

#### Scenario: Convert requires path, output, and format
- **WHEN** the `image` tool's `convert` action is invoked without a path, output, or format
- **THEN** schema validation fails with a descriptive error

#### Scenario: Field rejected on wrong action
- **WHEN** a field that only applies to one action is supplied to a different action
- **THEN** schema validation fails with a descriptive error

### Requirement: GenerateImage tool generates an image
The system SHALL provide a separate `generateImage` tool that generates an image from a text prompt via FAL.ai (FLUX Klein) and returns a native structured object `{ ok: true, imageUrl }` on success or `{ ok: false, error }` on failure. The FAL API key is resolved server-side from config/env and never passed by the model.

#### Scenario: Successful generation returns native object
- **WHEN** the `generateImage` tool is invoked with a valid prompt and a valid FAL API key
- **THEN** it returns `{ ok: true, imageUrl }` as a native object, not a stringified JSON string

#### Scenario: Missing prompt returns structured error
- **WHEN** the `generateImage` tool is invoked without a non-empty prompt
- **THEN** it returns `{ ok: false, error }` with a message that the prompt is required
