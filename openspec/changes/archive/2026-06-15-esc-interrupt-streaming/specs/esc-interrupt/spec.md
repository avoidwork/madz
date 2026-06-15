## ADDED Requirements

### Requirement: Escape key interrupts streaming agent
The system SHALL allow the user to interrupt the ReAct agent's streaming response by pressing the 'esc' key when the agent is actively streaming.

#### Scenario: User interrupts streaming with esc
- **WHEN** the agent is actively streaming a response (isStreamingRef.current is true)
- **AND** the user presses the 'esc' key
- **THEN** the system sets the interrupt signal (interruptRef.current = true)
- **AND** the streaming loop breaks and stops processing events
- **AND** the partial response content is displayed in the UI
- **AND** the input panel becomes available for new commands
- **AND** the application does NOT exit

#### Scenario: Esc during text streaming
- **WHEN** the agent is streaming text content
- **AND** the user presses 'esc'
- **THEN** the text streaming stops immediately
- **AND** the accumulated text content (committedContent) is displayed
- **AND** the message state is updated to streaming=false

#### Scenario: Esc during tool call
- **WHEN** the agent is executing a tool call
- **AND** the user presses 'esc'
- **THEN** the tool execution is interrupted
- **AND** any partial tool results are displayed
- **AND** the input panel becomes available

### Requirement: Escape key preserves existing exit behavior
The system SHALL maintain the existing 'esc' key behavior for non-streaming states.

#### Scenario: Esc during onboarding exits app
- **WHEN** the onboarding panel is displayed (showOnboarding is true)
- **AND** the user presses 'esc'
- **THEN** the application exits via handleQuit()

#### Scenario: Esc during banner display exits app
- **WHEN** the banner is displayed (showBanner is true)
- **AND** the user presses 'esc'
- **THEN** the application exits via handleQuit()

#### Scenario: Esc in idle state exits app
- **WHEN** the agent is not streaming (isStreamingRef.current is false)
- **AND** the user presses 'esc'
- **THEN** the application exits via handleQuit()

### Requirement: Interrupt signal is properly cleaned up
The system SHALL clean up the interrupt signal after interruption to prevent affecting subsequent operations.

#### Scenario: Interrupt ref is reset after interruption
- **WHEN** the agent is interrupted and the stream loop breaks
- **THEN** the interruptRef.current is reset to false
- **AND** the isStreamingRef.current is updated to false
- **AND** subsequent 'esc' presses use the normal exit behavior
