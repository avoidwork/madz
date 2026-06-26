# streaming-interruption Specification

## Purpose
TBD - created by archiving change graceful-streaming-interruption. Update Purpose after archive.
## Requirements
### Requirement: Intentional streaming interruptions SHALL not display error messages to the user

When a user sends a new message while the agent is streaming a response, the system SHALL handle the interruption gracefully by displaying a clean "Interrupted." status message instead of an error message.

#### Scenario: User interrupts streaming with new message
- **WHEN** the agent is streaming a response and the user sends a new message
- **THEN** the system SHALL abort the current stream and display "Interrupted." status
- **THEN** the system SHALL NOT display an error message to the user

#### Scenario: Intentional interrupt preserves cleanup behavior
- **WHEN** the user interrupts streaming
- **THEN** the system SHALL remove any orphaned tool-call messages from session state
- **THEN** the system SHALL clear the partial streaming assistant message from the UI
- **THEN** the system SHALL reset the abort controller and streaming flags

### Requirement: The system SHALL recognize intentional interruptions regardless of error type

The system SHALL use an explicit intent signal to distinguish intentional interruptions from unexpected errors, rather than relying on error type detection.

#### Scenario: Ref flag prevents error display for non-AbortError interruptions
- **WHEN** the abort signal triggers and throws an error with a non-standard name (e.g., DOMException)
- **THEN** the system SHALL check the intentional abort flag before deciding to display an error
- **THEN** the system SHALL suppress the error message if the flag indicates intentional interruption

#### Scenario: Error messages are shown for non-intentional failures
- **WHEN** a streaming response fails due to a network error or LLM API error (not user-initiated)
- **THEN** the system SHALL display an error message to the user
- **THEN** the intentional abort flag SHALL be false, allowing the error path to execute

### Requirement: The streaming function SHALL throw a named AbortError when the signal is already aborted

When `callReactAgentStreaming()` is entered with an already-aborted signal, it SHALL throw an error with `name === "AbortError"` to provide a consistent error type for downstream handlers.

#### Scenario: Early abort check throws named AbortError
- **WHEN** `callReactAgentStreaming()` is called with an already-aborted signal
- **THEN** the function SHALL throw an error with `name === "AbortError"`
- **THEN** the error SHALL include a descriptive message indicating the stream was interrupted

#### Scenario: Normal abort signal check inside stream loop
- **WHEN** the abort signal is triggered during streaming (after stream initialization)
- **THEN** the function SHALL check `signal.aborted` at the start of each iteration
- **THEN** the function SHALL clean up any pending tool calls and return early

