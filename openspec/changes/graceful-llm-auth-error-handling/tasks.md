## 1. Create Error Class Module

- [ ] 1.1 Create `src/error/index.js` with `AppError` base class (extends `Error`)
- [ ] 1.2 Create `AuthError` class extending `AppError` with `code: "invalid_api_key"` and `status: 401`
- [ ] 1.3 Create `RateLimitError` class extending `AppError` with `code: "rate_limited"` and `status: 429`
- [ ] 1.4 Create `TimeoutError` class extending `AppError` with `code: "timeout"` and `status: 408`
- [ ] 1.5 Create `NetworkError` class extending `AppError` with `code: "network_error"` and `status: 503`

## 2. Implement Error Classification

- [ ] 2.1 Implement `classifyError(err)` function that inspects `err.code`, `err.lc_error_code`, `err.status`, `err.statusCode`, and `err.message`
- [ ] 2.2 Handle `AgentError` with `interruptedReason: "User interrupted"` by re-throwing as-is
- [ ] 2.3 Check auth indicators first (`err.code === "invalid_api_key"` or `err.lc_error_code === "MODEL_AUTHENTICATION"`)
- [ ] 2.4 Check rate limit indicators (`err.status === 429` or `err.statusCode === 429`)
- [ ] 2.5 Check timeout indicators (`err.code` is `ECONNREFUSED`/`ECONNRESET`/`ETIMEDOUT`, `err.status === 408`, or message matches timeout patterns)
- [ ] 2.6 Fall back to wrapping unknown errors as `AppError`

## 3. Update Provider Dispatch Layer

- [ ] 3.1 Import `AppError`, `AuthError`, `classifyError` in `index.js`
- [ ] 3.2 Wrap `await callReactAgent(agent, message)` in `callProvider()` with try/catch that calls `classifyError()` and re-throws classified error
- [ ] 3.3 Modify `dispatchProvider()` to check if caught error is an `AuthError` and re-throw immediately without trying remaining providers
- [ ] 3.4 For non-auth errors in `dispatchProvider()`, continue the fallback chain and log the provider failure

## 4. Update TUI Error Display

- [ ] 4.1 Enhance `handleChat()` catch block in `src/tui/app.js` to extract `err.code` and `err.message` and display a structured message
- [ ] 4.2 Set status message to `"Error: [code]"` format so `StatusBar` shows the red indicator
- [ ] 4.3 Ensure system role messages display error info in yellow via existing `conversationPanel.js` styling

## 5. Update CLI Error Display

- [ ] 5.1 In the CLI chat mode catch block at `index.js:173-176`, format output as `Error: [code] - [message]` instead of just `err.message`

## 6. Add Unit Tests

- [ ] 6.1 Create `tests/unit/error.test.js` with tests for `AppError`, `AuthError`, `RateLimitError`, `TimeoutError`, `NetworkError` instantiation
- [ ] 6.2 Test error class inheritance (`instanceof` checks for each subclass)
- [ ] 6.3 Test `classifyError()` with mock LangChain `AuthenticationError` (code + lc_error_code paths)
- [ ] 6.4 Test `classifyError()` with mock `RateLimitError`
- [ ] 6.5 Test `classifyError()` with mock `TimeoutError` and `NetworkError`
- [ ] 6.6 Test `classifyError()` fallback to `AppError` for unknown errors
- [ ] 6.7 Test `classifyError()` passes through `AgentError` with `interruptedReason`
- [ ] 6.8 Test `callProvider()` classification wraps LangGraph errors in classified types
- [ ] 6.9 Test `dispatchProvider()` skips fallback on `AuthError`
- [ ] 6.10 Test `dispatchProvider()` continues fallback on non-auth errors
- [ ] 6.11 Test CLI mode displays classified error message
- [ ] 6.12 Test TUI handles error without crashing
