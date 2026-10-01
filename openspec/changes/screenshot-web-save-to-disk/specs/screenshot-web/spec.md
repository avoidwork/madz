## MODIFIED Requirements

### Requirement: Capture screenshot in headless Chromium

The system SHALL provide a `screenshotWeb` tool that renders a URL in headless Chromium, saves the captured PNG to disk under the configured screenshots directory, and returns the file path plus MIME type, so the agent can capture a rendered page and feed the saved file to `readImage` for vision analysis.

#### Scenario: Successful screenshot capture
- **WHEN** the tool is invoked with a valid URL
- **THEN** it saves the PNG to the screenshots directory and returns `{ ok: true, mimeType: "image/png", path }` where `path` is the absolute path to the saved file

#### Scenario: Screenshots directory does not exist
- **WHEN** the tool is invoked and the configured screenshots directory does not exist
- **THEN** the directory is created recursively before the file is written

#### Scenario: Invalid URL
- **WHEN** the tool is invoked with a URL that fails validation (blocked scheme, internal host, or malformed)
- **THEN** it returns `{ ok: false, error }` with a clear rejection reason

#### Scenario: Unreachable host
- **WHEN** the tool is invoked with a URL to an unreachable host
- **THEN** it returns `{ ok: false, error }` indicating the capture failed

#### Scenario: Page never finishes loading
- **WHEN** the tool is invoked with a URL to a page that never finishes loading
- **THEN** it returns `{ ok: false, error }` after the configured timeout

#### Scenario: Write failure
- **WHEN** the tool fails to write the screenshot to disk
- **THEN** it returns `{ ok: false, error }` indicating the write failed
