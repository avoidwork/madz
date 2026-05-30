## ADDED Requirements

### Requirement: Spinner Status Indicator
The system SHALL display an animated spinner in the TUI status bar to indicate
active processing during "Sending..." and "Streaming..." states.

#### Scenario: Spinner shows during sending
- **WHEN** the status message starts with "Sending"
- **THEN** the status bar renders the first spinner frame (`⠋`)

#### Scenario: Spinner shows during streaming
- **WHEN** the status message starts with "Streaming"
- **THEN** the status bar renders a spinner frame at ~80ms intervals

#### Scenario: Spinner hides when idle
- **WHEN** the status message is "Ready" or does not start with "Sending" or "Streaming"
- **THEN** the status bar renders a single-width space (no rotation)

#### Scenario: Spinner frame sequence
- **WHEN** the spinner is active
- **THEN** frames cycle through: `⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏` and wrap

#### Scenario: Layout stability
- **WHEN** the spinner frame changes
- **THEN** the rendered character is always single-width (no horizontal shift)

#### Scenario: Unit-testable frame mapping
- **WHEN** `getSpinnerFrame(n)` is called with a non-negative integer `n`
- **THEN** it returns the character at index `n % 10` of the frame sequence
