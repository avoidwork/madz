## Why

When an LLM provider returns an authentication error (e.g., invalid API key, expired token), the application crashes with an unhandled exception, bringing the entire app down instead of showing a graceful error message to the user. The error currently propagates from LangGraph's ReAct agent invocation up through `callReactAgent` with no catch at the dispatch layer because the provider fallback loop only catches errors from individual `callProvider` calls, but not from the actual `agent.invoke()` which throws `AuthenticationError` from the LangChain library.

## What Changes

- Introduce a structured error hierarchy with an `AppError` base class and domain-specific error classes (`AuthError`, `TimeoutError`, `RateLimitError`)
- Wrap all LLM provider calls (`agent.invoke()`) in try/catch blocks that classify errors into the new error types
- Display authenticated-LLM errors gracefully in the TUI with actionable information (redacted key hint, troubleshooting link) instead of crashing
- Add error classification logic to `index.js` that routes errors to the appropriate handler
- Update the provider fallback chain to distinguish transient errors from permanent auth failures (auth failures should NOT trigger provider fallback)

## Capabilities

### New Capabilities
- `error-handling`: Structured error types, error classification, graceful error display in TUI for LLM provider failures

### Modified Capabilities
- `tui-interface`: Error display in the TUI now shows structured error information (error type, redacted key) instead of a generic "Something went wrong" message

## Impact

- `src/provider/openai.js` - no direct changes, but errors propagate through it
- `src/agent/react.js` - may need to document error behavior or wrap calls
- `index.js` - primary target for error classification, provider fallback, and dispatch error handling
- `src/tui/app.js` - error display path needs to support structured error messages and role-based styling
- `src/tui/statusBar.js` - status indicator for auth errors
- No new dependencies
- No API or configuration changes
