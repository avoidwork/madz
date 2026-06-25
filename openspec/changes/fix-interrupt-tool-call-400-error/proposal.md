## Why

Interrupting a tool execution in the TUI causes an unrecoverable 400 error from the LLM API with the message "system message must be at the beginning." The root cause is that when `handleInterrupt()` aborts a running tool, it only removes the user's message from session state via `popExchange()`, but leaves the assistant's partial AIMessage (containing tool_calls that were never completed) in the conversation history. On resume, this corrupted message sequence — with an orphaned assistant message containing tool_calls but no corresponding ToolMessages — causes the LLM API to reject subsequent requests.

## What Changes

- Enhance `handleInterrupt()` in `src/tui/app.js` to clean up the assistant's tool-call message from session state when a tool is interrupted
- Add a helper function to safely remove the last assistant message with tool_calls from the conversation array
- Ensure the conversation state is consistent before the next dispatch to the LLM API
- Preserve existing behavior for non-tool-call interruptions (normal text responses)

## Capabilities

### New Capabilities
- `interrupt-cleanup`: Robust cleanup of assistant tool-call messages from session state when a tool execution is interrupted, preventing corrupted conversation history from being sent to the LLM API

### Modified Capabilities
<!-- None — this is a bug fix, not a requirement change -->

## Impact

- `src/tui/app.js` — `handleInterrupt()` function and the AbortError catch block in dispatchProvider
- `src/session/stateManager.js` — potential helper method for removing assistant messages with tool_calls
- No API changes, no dependency changes
- Affects only the TUI interrupt flow during tool execution