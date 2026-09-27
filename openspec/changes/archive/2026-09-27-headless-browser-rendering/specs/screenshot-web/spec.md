## ADDED Requirements

### Requirement: Capture screenshot in headless Chromium

The system SHALL provide a `screenshotWeb` tool that renders a URL in headless Chromium and returns a base64 PNG, so the agent can capture a rendered page and feed it to `readImage` for vision analysis.

#### Scenario: Successful screenshot capture
- **WHEN** the tool is invoked with a valid URL
- **THEN** it returns `{ ok: true, mimeType: "image/png", data }` where `data` is the base64-encoded PNG

#### Scenario: Invalid URL
- **WHEN** the tool is invoked with a URL that fails validation (blocked scheme, internal host, or malformed)
- **THEN** it returns `{ ok: false, error }` with a clear rejection reason

#### Scenario: Unreachable host
- **WHEN** the tool is invoked with a URL to an unreachable host
- **THEN** it returns `{ ok: false, error }` indicating the capture failed

#### Scenario: Page never finishes loading
- **WHEN** the tool is invoked with a URL to a page that never finishes loading
- **THEN** it returns `{ ok: false, error }` after the configured timeout

### Requirement: Validate URL against sandbox allowlist

The system SHALL validate the requested URL against the sandbox URL allowlist (`filterUrl`) before launching the browser, consistent with `extractWeb`, blocking `file:`/`gopher:`/`dict:` schemes and internal IPs.

#### Scenario: URL rejected by allowlist
- **WHEN** the tool is invoked with a URL not on the allowlist or using a blocked scheme
- **THEN** it returns `{ ok: false, error }` and does not launch the browser

#### Scenario: URL passes allowlist
- **WHEN** the tool is invoked with a URL that passes `filterUrl`
- **THEN** it proceeds to launch the browser

### Requirement: Enforce screenshot timeout

The system SHALL apply a per-call timeout to every browser launch to prevent resource exhaustion.

#### Scenario: Timeout exceeded
- **WHEN** the screenshot capture exceeds the configured timeout
- **THEN** the browser is closed and the tool returns `{ ok: false, error }` indicating a timeout

### Requirement: Validate screenshotWeb input schema

The system SHALL validate `screenshotWeb` input with a Zod schema requiring a valid URL string and an optional numeric timeout.

#### Scenario: Missing URL
- **WHEN** the tool is invoked without a `url`
- **THEN** schema validation fails and the tool returns an error

#### Scenario: Valid input
- **WHEN** the tool is invoked with a valid `url` and optional `timeout`
- **THEN** schema validation passes
