# Spec Delta

## MODIFIED Requirements

### Requirement: Read image from disk
The system SHALL provide a `readImage` tool that reads a local image file from disk and returns its base64-encoded contents plus the detected MIME type, so the payload can be passed directly to an LLM for vision analysis.

#### Scenario: Successful read
- **WHEN** the tool is invoked with a valid path to an existing image file within the sandbox allowlist
- **THEN** it returns `{ ok: true, content }` where `content` is an array of image content blocks (e.g., `[{ type: "image_url", image_url: { url: "data:<mime>;base64,<data>" } }]`)

#### Scenario: Missing file
- **WHEN** the tool is invoked with a path to a file that does not exist
- **THEN** it returns `{ ok: false, error }` with a clear "file not found" message
