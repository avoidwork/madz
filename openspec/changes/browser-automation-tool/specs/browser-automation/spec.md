## ADDED Requirements

### Requirement: Provide a browser automation tool

The system SHALL provide a `browser` tool that drives a real headless browser via Puppeteer, exposing an `action` discriminator that supports `navigate`, `click`, `type`/`fill`, `press`, `screenshot`, `extract`, `waitFor`, and `evaluate`.

#### Scenario: Tool is registered and callable
- **WHEN** the tool is registered in `src/tools/index.js` with `network:outbound` permission
- **THEN** it is available to the agent and returns a JSON result string

#### Scenario: Unknown action
- **WHEN** the tool is invoked with an `action` not in the supported set
- **THEN** schema validation fails and the tool returns `{ ok: false, error }`

### Requirement: Validate browser tool input schema

The system SHALL validate `browser` input with a Zod discriminated union keyed on `action`, requiring action-specific params and rejecting invalid inputs.

#### Scenario: Missing action
- **WHEN** the tool is invoked without an `action`
- **THEN** schema validation fails and the tool returns an error

#### Scenario: Missing required param for an action
- **WHEN** the tool is invoked with an action that requires a param (e.g. `navigate` without `url`)
- **THEN** schema validation fails and the tool returns an error

#### Scenario: Valid input for each action
- **WHEN** the tool is invoked with a valid `action` and its required params
- **THEN** schema validation passes

### Requirement: Validate outbound URLs against the sandbox allowlist

The system SHALL validate every outbound URL against `filterUrl` before navigation, blocking `file:`/`gopher:`/`dict:` schemes and internal/private IPs.

#### Scenario: URL rejected by allowlist
- **WHEN** the tool is invoked with a URL that fails `filterUrl` (blocked scheme or internal host)
- **THEN** it returns `{ ok: false, error }` and does not launch the browser

#### Scenario: URL passes allowlist
- **WHEN** the tool is invoked with a URL that passes `filterUrl`
- **THEN** it proceeds to navigate

### Requirement: Navigate to a URL

The system SHALL support a `navigate` action that opens a validated URL in a new page.

#### Scenario: Successful navigation
- **WHEN** the `navigate` action is invoked with a valid URL
- **THEN** it returns `{ ok: true, url }` and the page is loaded

#### Scenario: Navigation timeout
- **WHEN** the page fails to load within the configured timeout
- **THEN** it returns `{ ok: false, error }` indicating a timeout

### Requirement: Click an element

The system SHALL support a `click` action that clicks a DOM element matching a selector.

#### Scenario: Successful click
- **WHEN** the `click` action is invoked with a selector that matches an element
- **THEN** it returns `{ ok: true }` and the element is clicked

#### Scenario: Selector not found
- **WHEN** the `click` action is invoked with a selector that matches no element
- **THEN** it returns `{ ok: false, error }` indicating the selector was not found

### Requirement: Type or fill text

The system SHALL support `type`/`fill` actions that enter text into an element matching a selector.

#### Scenario: Successful fill
- **WHEN** the `type`/`fill` action is invoked with a selector and text
- **THEN** it returns `{ ok: true }` and the text is entered

#### Scenario: Selector not found
- **WHEN** the `type`/`fill` action is invoked with a selector that matches no element
- **THEN** it returns `{ ok: false, error }` indicating the selector was not found

### Requirement: Press a key

The system SHALL support a `press` action that presses a keyboard key (e.g. `Enter`, `Tab`).

#### Scenario: Successful press
- **WHEN** the `press` action is invoked with a valid key
- **THEN** it returns `{ ok: true }`

### Requirement: Take a screenshot

The system SHALL support a `screenshot` action that captures the current page as a base64 image (suitable for `readImage`).

#### Scenario: Successful screenshot
- **WHEN** the `screenshot` action is invoked
- **THEN** it returns `{ ok: true, image }` where `image` is a base64-encoded image

### Requirement: Extract DOM text

The system SHALL support an `extract` action that returns the page's text content.

#### Scenario: Successful extract
- **WHEN** the `extract` action is invoked
- **THEN** it returns `{ ok: true, content }` where `content` is the page text

### Requirement: Wait for a selector or network idle

The system SHALL support a `waitFor` action that waits for a selector to appear or for network idle.

#### Scenario: Selector appears
- **WHEN** the `waitFor` action is invoked with a selector that eventually appears
- **THEN** it returns `{ ok: true }`

#### Scenario: Timeout waiting for selector
- **WHEN** the `waitFor` action times out waiting for a selector
- **THEN** it returns `{ ok: false, error }` indicating a timeout

### Requirement: Evaluate JS in page context

The system SHALL support an `evaluate` action that runs JavaScript in the page context and returns the serialized result.

#### Scenario: Successful evaluate
- **WHEN** the `evaluate` action is invoked with a JS expression
- **THEN** it returns `{ ok: true, result }` where `result` is the serialized value

#### Scenario: Evaluate error
- **WHEN** the `evaluate` action's JS throws
- **THEN** it returns `{ ok: false, error }`

### Requirement: Close the browser after each call

The system SHALL close the browser in a `finally` block after each call to prevent resource exhaustion.

#### Scenario: Browser closed on success
- **WHEN** a `browser` action completes successfully
- **THEN** the browser is closed

#### Scenario: Browser closed on error
- **WHEN** a `browser` action throws or returns an error
- **THEN** the browser is closed
