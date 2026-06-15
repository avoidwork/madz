## Why

When the Madz agent is actively streaming a response, pressing 'esc' exits the entire application instead of interrupting the agent. This prevents users from quickly canceling a response and issuing a new command — a common workflow when the model is "choosing violence" or taking too long. Users need a way to interrupt the ReAct node and close the stream without quitting the harness.

## What Changes

- **New capability:** Escape key interrupts streaming agent when active
  - When the agent is streaming, 'esc' sets an interrupt signal and breaks the stream loop
  - The partial response is displayed and the input panel becomes available
  - The application remains running for new commands
- **Preserved behavior:** Escape key still exits the application when NOT streaming
  - Onboarding phase: 'esc' exits (unchanged)
  - Banner display: 'esc' exits (unchanged)
  - Idle/input-focused states: 'esc' exits (unchanged)
- **No breaking changes** to existing APIs or data formats

## Capabilities

### New Capabilities
- `esc-interrupt`: Graceful interruption of ReAct agent streaming via escape key

### Modified Capabilities
<!-- None — this is a new capability, not a modification of existing requirements -->

## Impact

- **Affected code:**
  - `src/tui/app.js` — Key handling in `useInput` callback, message state management
  - `src/agent/react.js` — `callReactAgentStreaming` function, stream event loop
  - `index.js` — `dispatchProvider` and `callProvider` functions
- **Dependencies:** No new external dependencies
- **Systems:** TUI layer, agent streaming layer, provider dispatch layer
