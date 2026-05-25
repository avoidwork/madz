## Context

The application uses LangChain/LangGraph to call LLM providers (OpenAI, etc.) through a provider dispatch layer. When the LLM provider returns an authentication error (401 incorrect/expired API key), the `AuthenticationError` from LangChain propagates up through `agent.invoke()` -> `callReactAgent()` -> `callProvider()` -> `dispatchProvider()` without being caught by the provider fallback loop because `handleConversation()` calls `dispatchProvider()` and the error bubbles up to the top-level handler, which in CLI mode prints and exits, and in TUI mode causes an unhandled exception that crashes the process.

Currently, `handleChat` in `src/tui/app.js:87-107` has a try/catch on `dispatchProvider()` but it catches the error and displays a generic "I couldn't connect right now" message with no classification or useful information for the user.

## Goals / Non-Goals

**Goals:**
- Classify LLM provider errors into structured types (auth, rate limit, timeout, network, unknown)
- Prevent unhandled exceptions from crashing the application
- Display actionable error information in the TUI (error type, redacted key hint)
- Skip provider fallback for permanent errors like authentication failures
- Maintain 100% test coverage on error handling paths

**Non-Goals:**
- Adding new LLM providers
- Changing the LangGraph agent architecture
- Implementing automatic API key rotation or recovery
- Handling tool-level errors (separate concern)
- Adding retry logic for auth failures (they should be rejected immediately)

## Decisions

### Decision 1: Error Class Hierarchy
**Choice**: Define error classes in `src/error/index.js` with an `AppError` base class and subclasses.

```
AppError (extends Error)
├── AuthError (extends AppError) - code: "invalid_api_key", status: 401
├── RateLimitError (extends AppError) - code: "rate_limited", status: 429
├── TimeoutError (extends AppError) - code: "timeout", status: 408
└── NetworkError (extends AppError) - code: "network_error", status: 503
```

**Rationale**: The AGENTS.md convention already defines `AppError` at `AGENTS.md:184`. Placing them in `src/error/index.js` mirrors the existing `src/config/loader.js` and `src/config/schemas.js` pattern. Each class carries an HTTP status code and a machine-readable code for programmatic matching.

**Alternatives considered**:
- Using a single error class with a `code` property: Less type-safe, harder to match with `instanceof`
- Using error codes via string constants: No compile-time or runtime type discrimination

### Decision 2: Error Classification Location
**Choice**: Create an `classifyError(err)` function in `src/error/index.js` that inspects error properties and returns a classified AppError subclass instance. Call this in `callProvider()` wrapping the `callReactAgent()` invocation.

**Rationale**: `callProvider()` at `index.js:82-93` is the natural boundary between the application's dispatch logic and the LLM provider call. Classifying errors here keeps classification logic close to the call site and ensures errors are typed before they reach the fallback loop.

**Flow**:
```
callProvider()
  └── try { agent.invoke() }
      └── catch (err)
          └── classifyError(err)  → returns AppError subclass
          └── re-throw classified error
```

**Alternatives considered**:
- Classifying in `dispatchProvider()`: Would classify errors after the fallback attempt, losing per-provider error detail
- Classifying in TUI: TUI should be a consumer of structured errors, not the classifier

### Decision 3: Auth Errors Skip Fallback
**Choice**: In `dispatchProvider()`, when a classified error has an `auth` dimension, log it and re-throw immediately without trying remaining providers in the fallback chain.

**Rationale**: An invalid API key is a per-provider credential issue. It will fail on every fallback provider that uses the same keys. Skipping the fallback chain saves time and avoids redundant failed API calls.

**Alternatives considered**:
- Continuing fallback: Wastes time and resources when auth is the problem
- No fallback for any error: We still want to retry transient errors (network, rate limits)

### Decision 4: TUI Error Display
**Choice**: Enhance the error message in `handleChat()` to include the classified error's message, code, and a redacted key hint. The message is displayed as a "system" role message (yellow) plus a red status indicator.

**Rationale**: The existing `addMessage({ role: "system", ... })` pattern already displays errors in yellow. The `StatusBar` already supports red error indicators (line 9-11 of `src/tui/statusBar.js` checks for "Error" prefix). No new UI components needed.

**Alternatives considered**:
- New TUI component: Overkill for display-only change
- Modal dialog: TUI uses a simple chat paradigm, no dialogs needed

### Decision 5: Error Classification Rules
**Choice**: Classify based on these priority-ordered checks:

1. If `err.code === "invalid_api_key"` or `err.lc_error_code === "MODEL_AUTHENTICATION"` → `AuthError`
2. If `err.status === 429` (via `err.status` or `statusCode` or `err.statusCode`) → `RateLimitError`
3. If `err` has `isNetworkError`, or code is `ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`, or error message matches timeout patterns → `TimeoutError`
4. If `err.status === 408` → `TimeoutError`
5. If `err` is an `AgentError` with `interruptedReason` matching "User interrupted" → re-throw as-is (control flow, not error)
6. Otherwise → `AppError` with `err.message`

**Rationale**: This mirrors the existing classification in `src/tools/common.js:75-91` (`classifyProviderError`) but extends it. Priority ordering matters because LangChain's `AuthenticationError` carries both `code: "invalid_api_key"` and potentially status code 401 from the HTTP layer.

## Risks / Trade-offs

[Risk] Error classification could be brittle if LangChain changes their error shapes → Mitigation: Use multiple detection heuristics (`err.code`, `err.lc_error_code`, `typeof err.status`) rather than a single property check. Add tests covering known LangChain error structures.

[Risk] Adding error classes adds surface area for bugs → Mitigation: Each class is a simple one-line definition. The classification function has clear, testable rules.

[Risk] Skipping auth errors in fallback may hide misconfigured providers → Mitigation: Log the error at the top level and show a clear message in the TUI. The user can change providers via CLI command (`/provider openai`).

[Trade-off] Error messages in the TUI include some implementation detail (e.g., `MODEL_AUTHENTICATION`) → Mitigation: The message displayed to the user is the LangChain error message which is already user-facing ("Incorrect API key provided"). The `code` property is for internal use.

## Migration Plan

This is an additive change with no breaking API or configuration changes. No migration needed. The error classes and classification function are imported where needed. The provider dispatch layer adopts the new error types transparently.

Deployment order:
1. Apply change (implements error classes, classification, handler updates)
2. Run tests (`npm run test`)
3. Run coverage (`npm run coverage` - pre-commit enforces 100%)
4. Lint and format (`npm run fix`)

## Open Questions

- Should the TUI include a "retry" prompt in the error message? (Currently no interactive prompt mechanism exists — would require new TUI feature, out of scope)
- How should we handle auth failures on all fallback providers? (Current design: show the last provider's error message)
