## 1. Create Error Class Module

- [x] 1.1 Create `src/error/index.js` with `AppError` base class (extends `Error`)
- [x] 1.2 Create `AuthError` class extending `AppError` with `code: "invalid_api_key"` and `status: 401`
- [x] 1.3 Create `RateLimitError` class extending `AppError` with `code: "rate_limited"` and `status: 429`
- [x] 1.4 Create `TimeoutError` class extending `AppError` with `code: "timeout"` and `status: 408`
- [x] 1.5 Create `NetworkError` class extending `AppError` with `code: "network_error"` and `status: 503`

## 2. Implement Error Classification

- [x] 2.1 Implement `classifyError(err)` function that inspects `err.code`, `err.lc_error_code`, `err.status`, `err.statusCode`, and `err.message`
- [x] 2.2 Handle `AgentError` with `interruptedReason: "User interrupted"` by re-throwing as-is
- [x] 2.3 Check auth indicators first (`err.code === "invalid_api_key"` or `err.lc_error_code === "MODEL_AUTHENTICATION"`)
- [x] 2.4 Check rate limit indicators (`err.status === 429` or `err.statusCode === 429`)
- [x] 2.5 Check timeout indicators (`err.code` is `ECONNREFUSED`/`ECONNRESET`/`ETIMEDOUT`, `err.status === 408`, or message matches timeout patterns)
- [x] 2.6 Fall back to wrapping unknown errors as `AppError`

## 3. Update Provider Dispatch Layer

- [x] 3.1 Import `AppError`, `AuthError`, `classifyError` in `index.js`
- [x] 3.2 Wrap `await callReactAgent(agent, message)` in `callProvider()` with try/catch that calls `classifyError()` and re-throws classified error
- [x] 3.3 Modify `dispatchProvider()` to check if caught error is an `AuthError` and re-throw immediately without trying remaining providers
- [x] 3.4 For non-auth errors in `dispatchProvider()`, continue the fallback chain and log the provider failure

## 4. Update TUI Error Display

- [x] 4.1 Enhance `handleChat()` catch block in `src/tui/app.js` to extract `err.code` and `err.message` and display a structured message
- [x] 4.2 Set status message to `"Error: [code]"` format so `StatusBar` shows the red indicator
- [x] 4.3 Ensure system role messages display error info in yellow via existing `conversationPanel.js` styling

## 5. Update CLI Error Display

- [x] 5.1 In the CLI chat mode catch block at `index.js:173-176`, format output as `Error: [code] - [message]` instead of just `err.message`

## 6. Add Unit Tests

- [x] 6.1 Create `tests/unit/error.test.js` with tests for `AppError`, `AuthError`, `RateLimitError`, `TimeoutError`, `NetworkError` instantiation
- [x] 6.2 Test error class inheritance (`instanceof` checks for each subclass)
- [x] 6.3 Test `classifyError()` with mock LangChain `AuthenticationError` (code + lc_error_code paths)
- [x] 6.4 Test `classifyError()` with mock `RateLimitError`
- [x] 6.5 Test `classifyError()` with mock `TimeoutError` and `NetworkError`
- [x] 6.6 Test `classifyError()` fallback to `AppError` for unknown errors
- [x] 6.7 Test `classifyError()` passes through `AgentError` with `interruptedReason`
- [x] 6.8 Test `callProvider()` classification wraps LangGraph errors in classified types
- [x] 6.9 Test `dispatchProvider()` skips fallback on `AuthError`
- [x] 6.10 Test `dispatchProvider()` continues fallback on non-auth errors
- [x] 6.11 Test CLI mode displays classified error message
- [x] 6.12 Test TUI handles error without crashing
