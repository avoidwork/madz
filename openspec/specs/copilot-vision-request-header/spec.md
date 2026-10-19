# copilot-vision-request-header Specification

## Purpose
Detect image content anywhere in a GitHub Copilot request body and mark the request with the `Copilot-Vision-Request` header that the Copilot API requires for vision payloads, across the Completions, Responses, and Anthropic Messages API shapes.
## Requirements
### Requirement: Copilot vision request header
The system SHALL set the `Copilot-Vision-Request: true` header on every GitHub Copilot request whose payload contains image content, because the Copilot API rejects image-bearing requests that omit it with `400 missing required Copilot-Vision-Request header for vision requests`.

#### Scenario: Completions API image is marked
- **WHEN** a Copilot request body has `messages` with a content part of type `image_url`
- **THEN** the request carries the `Copilot-Vision-Request: true` header

#### Scenario: Responses API image is marked
- **WHEN** a Copilot request body has `input` with a content part of type `input_image`
- **THEN** the request carries the `Copilot-Vision-Request: true` header

#### Scenario: Anthropic Messages API image is marked
- **WHEN** a Copilot request body has `messages` with a content part of type `image`
- **THEN** the request carries the `Copilot-Vision-Request: true` header

#### Scenario: Image nested in a tool result is marked
- **WHEN** a Copilot request body has a content part of type `tool_result` whose own `content` array contains a part of type `image`
- **THEN** the request carries the `Copilot-Vision-Request: true` header

#### Scenario: Text-only request is not marked
- **WHEN** a Copilot request body contains only text content
- **THEN** the request does not carry the `Copilot-Vision-Request` header

### Requirement: Vision detection scans the entire request body
The system SHALL detect image content by scanning every message in the request body, not only the final message, so that an image injected on an earlier turn still marks subsequent requests as vision requests.

#### Scenario: Image outside the final message
- **WHEN** an image content part appears in a message other than the last one
- **THEN** the request carries the `Copilot-Vision-Request: true` header

#### Scenario: Final message is text after an earlier image
- **WHEN** the last message is plain text and an earlier message carries an image
- **THEN** the request is still classified as a vision request

### Requirement: Vision detection tolerates malformed request bodies
The system SHALL NOT throw when determining whether a Copilot request is a vision request, and SHALL treat any body it cannot interpret as non-vision.

#### Scenario: Body is not valid JSON
- **WHEN** the request body is a string that fails to parse as JSON
- **THEN** the request is classified as non-vision and the request proceeds

#### Scenario: Body is already a parsed object
- **WHEN** the request body is an object rather than a JSON string
- **THEN** vision detection reads it directly and sets the header when image content is present

#### Scenario: Content entries are null or primitive
- **WHEN** a message content array contains null entries, bare strings, or non-image objects
- **THEN** detection skips them without throwing and classifies the request as non-vision

#### Scenario: Message has no content
- **WHEN** a message omits `content` or sets it to null
- **THEN** detection skips it without throwing

### Requirement: Vision header is sent without capability gating
The system SHALL set the vision header based solely on the presence of image content, without consulting the target model's advertised vision capabilities.

#### Scenario: Non-vision model receives the header
- **WHEN** image content is present in a request to a model that does not advertise vision support
- **THEN** the header is still set, because it is a routing hint rather than a capability assertion

