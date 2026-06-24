## Why

When a tool execution is interrupted mid-execution, the system throws an unrecoverable 400 error with the message "System message must be at the beginning." This occurs because the conversation state becomes corrupted after interruption — the system message is no longer the first message in the conversation array, violating the OpenAI API's strict ordering requirement. Users cannot continue their conversation after an interruption without restarting the application.

## What Changes

- Add an `isInterrupting` state flag to track when an interruption is in progress
- Reset conversation state to a valid configuration (system message first) when an interruption occurs
- Catch and gracefully handle non-AbortError errors that occur during active interruption
- Ensure the abort signal propagates correctly through the tool execution chain
- Add new requirement to tui-conversation spec for graceful error handling during tool interruption

## Capabilities

### New Capabilities
<!-- None — this is a bug fix, not a new capability -->

### Modified Capabilities
- `tui-conversation`: Add requirement for graceful error handling during tool interruption — the system SHALL catch and handle non-AbortError errors that occur during an active interruption without displaying them as unrecoverable errors

## Impact

- `src/tui/app.js` — handleInterrupt() function, try/catch around dispatchProvider calls, conversation state management
- `src/provider/openai.js` — conversation message construction, system message ordering guard
- `openspec/specs/tui-conversation/spec.md` — new requirement for interruption error handling