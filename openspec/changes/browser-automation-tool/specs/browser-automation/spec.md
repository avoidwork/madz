## ADDED Requirements

### Requirement: Browser tool drives a headless browser
The system SHALL provide a `browser` tool that drives a real headless Chromium browser via `puppeteer-core`, reusing the existing `launchBrowser`/`openPage` helpers in `src/tools/web/browser.js`.

#### Scenario: Tool is registered
- **WHEN** the tool registry is built via `buildToolConfig`
- **THEN** the `browser` tool is present in the returned tool list when the `network:outbound` permission is enabled

#### Scenario: Browser launches against system Chromium
- **WHEN** the `browser` tool is invoked
- **THEN** it launches a headless Chromium via `launchBrowser` and closes the browser in a `finally` block

### Requirement: Browser tool supports navigation
The system SHALL support a `navigate` action that navigates the page to a URL.

#### Scenario: Navigate to a valid URL
- **WHEN** the `browser` tool is invoked with `action: "navigate"` and a valid URL
- **THEN** the page navigates to the URL and returns a success result

#### Scenario: Navigate to a blocked URL
- **WHEN** the `browser` tool is invoked with `action: "navigate"` and a URL rejected by `filterUrl`
- **THEN** the tool returns a JSON error string indicating the URL was rejected

### Requirement: Browser tool supports clicking elements
The system SHALL support a `click` action that clicks an element matching a CSS selector.

#### Scenario: Click an existing element
- **WHEN** the `browser` tool is invoked with `action: "click"` and a selector that matches an element
- **THEN** the element is clicked and a success result is returned

#### Scenario: Click a missing element
- **WHEN** the `browser` tool is invoked with `action: "click"` and a selector that matches no element
- **THEN** the tool returns a JSON error string

### Requirement: Browser tool supports typing and filling inputs
The system SHALL support `type` and `fill` actions that enter text into an input matching a CSS selector.

#### Scenario: Type into an input
- **WHEN** the `browser` tool is invoked with `action: "type"`, a selector, and text
- **THEN** the text is typed into the input and a success result is returned

#### Scenario: Fill an input
- **WHEN** the `browser` tool is invoked with `action: "fill"`, a selector, and text
- **THEN** the input's existing value is cleared and the text is entered

### Requirement: Browser tool supports pressing keys
The system SHALL support a `press` action that presses a keyboard key.

#### Scenario: Press a key
- **WHEN** the `browser` tool is invoked with `action: "press"` and a key
- **THEN** the key is pressed via `page.keyboard.press` and a success result is returned

### Requirement: Browser tool supports taking screenshots
The system SHALL support a `screenshot` action that captures a full-page screenshot as base64.

#### Scenario: Capture a screenshot
- **WHEN** the `browser` tool is invoked with `action: "screenshot"`
- **THEN** the tool returns a base64-encoded screenshot suitable for `readImage`

### Requirement: Browser tool supports extracting DOM text
The system SHALL support an `extract` action that returns the page's DOM text.

#### Scenario: Extract page text
- **WHEN** the `browser` tool is invoked with `action: "extract"`
- **THEN** the tool returns the page's `document.body.innerText`

### Requirement: Browser tool supports waiting for conditions
The system SHALL support a `waitFor` action that waits for a selector or network idle.

#### Scenario: Wait for a selector
- **WHEN** the `browser` tool is invoked with `action: "waitFor"` and a selector
- **THEN** the tool waits for the selector to appear and returns a success result

#### Scenario: Wait for network idle
- **WHEN** the `browser` tool is invoked with `action: "waitFor"` and `waitUntil: "networkidle"`
- **THEN** the tool waits for network idle and returns a success result

### Requirement: Browser tool supports evaluating JavaScript in page context
The system SHALL support an `evaluate` action that runs JavaScript in the page context.

#### Scenario: Evaluate JavaScript
- **WHEN** the `browser` tool is invoked with `action: "evaluate"` and a function body
- **THEN** the function is executed via `page.evaluate` and the result is returned

### Requirement: Browser tool validates URLs against the sandbox allowlist
The system SHALL validate every outbound URL against `filterUrl` from `src/sandbox/urlFilter.js`.

#### Scenario: URL validation is enforced
- **WHEN** the `browser` tool is invoked with a URL-bearing action and a URL rejected by `filterUrl`
- **THEN** the tool returns a JSON error string and does not navigate

### Requirement: Browser tool validates inputs with a Zod schema
The system SHALL validate all tool inputs with a Zod schema.

#### Scenario: Invalid action is rejected
- **WHEN** the `browser` tool is invoked with an unknown `action`
- **THEN** the tool returns a JSON error string indicating the action is invalid

#### Scenario: Missing required fields are rejected
- **WHEN** the `browser` tool is invoked without required fields for the given action
- **THEN** the tool returns a JSON error string
