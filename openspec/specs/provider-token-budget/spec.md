# provider-token-budget Specification

## Purpose
TBD - created by archiving change configurable-tokens-per-minute-rate-limiting. Update Purpose after archive.
## Requirements
### Requirement: Rolling token window tracks consumed tokens
The `src/provider/tokenBudget.js` module SHALL maintain a rolling 60-second window of consumed tokens. The `consume(tokens)` function SHALL record a token consumption entry with a timestamp, and `current()` SHALL return the sum of tokens consumed within the last 60 seconds, evicting entries older than 60 seconds.

#### Scenario: consume records tokens in the window
- **WHEN** `consume(1000)` is called
- **THEN** `current()` returns `1000`

#### Scenario: current evicts entries older than 60 seconds
- **WHEN** a token entry is older than 60 seconds
- **THEN** `current()` excludes it from the returned sum

#### Scenario: current returns zero when window is empty
- **WHEN** no tokens have been consumed
- **THEN** `current()` returns `0`

### Requirement: waitForCapacity resolves when the window has room
The `waitForCapacity(estimatedTokens)` function SHALL resolve once the rolling window has room for `estimatedTokens` tokens without exceeding the configured `maxTokensMinute` budget. It SHALL wait (delay) when the window is near capacity and resolve immediately when room is available.

#### Scenario: waitForCapacity resolves immediately when room is available
- **WHEN** `current()` plus `estimatedTokens` is within the budget
- **THEN** `waitForCapacity(estimatedTokens)` resolves without delay

#### Scenario: waitForCapacity waits when the window is near capacity
- **WHEN** `current()` plus `estimatedTokens` exceeds the budget
- **THEN** `waitForCapacity(estimatedTokens)` delays until the window has room, then resolves

#### Scenario: waitForCapacity handles a request larger than the whole budget
- **WHEN** `estimatedTokens` exceeds the entire `maxTokensMinute` budget
- **THEN** `waitForCapacity(estimatedTokens)` waits until the window drains, then resolves

### Requirement: Throttle is disabled when maxTokensMinute is zero
When `maxTokensMinute` is `0`, the token-budget throttle SHALL be disabled. No token consumption is tracked,
`waitForCapacity` SHALL resolve immediately without delay, and the `TokenBudget` middleware SHALL pass through to
the model handler without reserving.

#### Scenario: disabled path does not track tokens
- **WHEN** `maxTokensMinute` is `0`
- **THEN** `consume()` and `waitForCapacity()` are no-ops and `current()` returns `0`

#### Scenario: disabled path resolves immediately
- **WHEN** `maxTokensMinute` is `0`
- **THEN** `waitForCapacity(estimatedTokens)` resolves immediately regardless of `estimatedTokens`

#### Scenario: disabled middleware passes through
- **WHEN** `maxTokensMinute` is `0` and the middleware wraps a model call
- **THEN** the handler is invoked with no reservation recorded

### Requirement: Context-cost estimation is extracted into a shared helper
The context-cost logic used by the `TokenBudget` middleware (conversation tokens plus the configured output budget) SHALL be extracted into an exported `estimateContextCost` function in `src/provider/tokenBudgetMiddleware.js`. The middleware SHALL delegate to this helper so the middleware and the TUI share the same cost logic, and the helper SHALL be callable regardless of whether `maxTokensMinute` is configured.

#### Scenario: Middleware delegates to the shared helper
- **WHEN** the `TokenBudget` middleware estimates a request cost
- **THEN** it uses the exported `estimateContextCost` helper, so the middleware and the TUI share the same cost logic

#### Scenario: Helper is callable when the budget is disabled
- **WHEN** `maxTokensMinute` is `0` (or unset) and the exported helper is called
- **THEN** it still computes the estimate (it does not depend on the budget being enabled)

#### Scenario: Helper adds the output budget to the conversation estimate
- **WHEN** the exported helper is called with a conversation and `{ model, encoding, maxTokens }`
- **THEN** it returns `calculateConversationTokens(conversation, model, encoding) + (maxTokens || 0)`

### Requirement: Enforcement happens in wrapModelCall middleware
Token-budget enforcement SHALL be implemented as a `wrapModelCall` middleware named `TokenBudget`, created by a
factory in `src/provider/tokenBudgetMiddleware.js` and registered on `createDeepAgent({ middleware: [...] })`.
Enforcement SHALL NOT be implemented by overriding `invoke`/`stream` on a model instance, because
`ChatOpenAI.bindTools()` delegates to `withConfig()`, which constructs a new model object and discards
instance-property overrides.

#### Scenario: middleware fires on the real agent dispatch path
- **WHEN** a `createAgent` (or `createDeepAgent`) instance with the `TokenBudget` middleware dispatches a model
  call through `AgentNode`, which calls `bindTools()` before invoking
- **THEN** the middleware's `wrapModelCall` runs for that dispatch and the shared budget's `current()` changes

#### Scenario: enforcement survives bindTools
- **WHEN** the agent binds tools to the model prior to dispatch
- **THEN** the budget is still charged for that dispatch, unlike an instance-property wrapper

#### Scenario: middleware is registered innermost
- **WHEN** the middleware array is composed by `AgentNode` (first entry outermost, last entry innermost)
- **THEN** `TokenBudget` is the last `wrapModelCall` entry, so its estimate is computed from the final
  post-truncation message set

#### Scenario: middleware reaches subagents
- **WHEN** `createDeepAgent` builds subagent middleware stacks
- **THEN** the `TokenBudget` middleware from `input.middleware` is present in each subagent's stack, so subagent
  dispatches are charged to the same shared window

### Requirement: Middleware reserves before dispatch and reconciles after
The `TokenBudget` middleware SHALL estimate the request cost from `request.messages`, `request.systemMessage`,
and `request.tools`, call `budget.reserve(estimate)` before invoking `handler(request)`, and on success call
`budget.reconcile(handle, actualTokens)` using the usage reported by the response. On any throw it SHALL call
`budget.release(handle)`.

#### Scenario: successful dispatch reconciles to actual usage
- **WHEN** a dispatch succeeds and the response carries usage metadata
- **THEN** the reserved entry is adjusted to the actual prompt + completion total

#### Scenario: failed dispatch does not consume budget
- **WHEN** `handler(request)` throws a non-rate-limit error
- **THEN** the reservation is released and `current()` does not include the failed request's tokens

#### Scenario: dispatch without usage keeps the estimate
- **WHEN** a dispatch succeeds but the response carries no usage field
- **THEN** the reserved estimate remains in the window, with no crash and no double-charge

### Requirement: Middleware re-paces the 429 retry and attributes the cause
The `TokenBudget` middleware SHALL, on a `429` rate-limit error, release the failed attempt's reservation, sleep
for the `retry-after` delay (or the default), call `waitForCapacity` again, and re-dispatch. Only the attempt
that succeeds SHALL be charged. When the rolling window exceeds `maxTokensMinute` at the time of a `429`, the
middleware SHALL log the error as an exceeded token budget rather than an opaque provider error.

#### Scenario: 429 retry waits for capacity again
- **WHEN** a dispatch fails with a `429` and a retry is scheduled
- **THEN** `waitForCapacity` is called before re-dispatching, so the retry does not fire while the window is over
  capacity

#### Scenario: only the successful attempt is charged
- **WHEN** a dispatch fails with a `429` and the retry succeeds
- **THEN** the window contains exactly one charge — the successful attempt's tokens — not two

#### Scenario: 429 attributed to exceeded token budget
- **WHEN** a `429` is caught and `current()` exceeds `maxTokensMinute`
- **THEN** the error is logged as an exceeded token budget

#### Scenario: 429 not attributed when budget not exceeded
- **WHEN** a `429` is caught and `current()` does not exceed `maxTokensMinute`
- **THEN** the error is not attributed to an exceeded token budget

### Requirement: Middleware is a no-op when the budget is disabled
When `maxTokensMinute` is `0`, the middleware SHALL pass through to `handler(request)` without reserving,
reconciling, releasing, or delaying.

#### Scenario: disabled middleware does not touch the budget
- **WHEN** `maxTokensMinute` is `0` and a dispatch occurs
- **THEN** `reserve` is not called and `current()` remains `0`

### Requirement: Atomic reserve prevents concurrent overshoot
The token budget SHALL expose a `reserve(estimatedTokens)` function that atomically waits for capacity and
records the consumption under a single lock/queue, so that concurrent callers cannot each pass the capacity check
and overshoot the window. `reserve` SHALL return a handle identifying the recorded entry.

#### Scenario: Concurrent reserves do not overshoot the budget
- **WHEN** multiple concurrent `reserve` calls each request an amount such that only one fits within the
  remaining window capacity
- **THEN** only the calls that fit are admitted immediately; the rest wait until the window drains, and the sum
  of admitted tokens never exceeds `maxTokensMinute` within the window

#### Scenario: reserve returns a handle for the recorded entry
- **WHEN** `reserve(tokens)` is called
- **THEN** it resolves to a handle that identifies the specific consumption entry recorded

#### Scenario: reserve is a no-op when disabled
- **WHEN** `maxTokensMinute` is `0`
- **THEN** `reserve` resolves immediately with a null handle and records nothing

### Requirement: Reconcile adjusts a consumed entry to actual usage
The token budget SHALL expose a `reconcile(handle, actualTokens)` function that adjusts the consumption entry
identified by `handle` to `actualTokens`, replacing the pre-dispatch estimate with the real token total reported
by the API.

#### Scenario: reconcile replaces estimate with actual
- **WHEN** an entry was reserved with an estimate of 1000 and `reconcile(handle, 1500)` is called
- **THEN** `current()` reflects 1500 for that entry, not 1000

#### Scenario: reconcile with a lower actual reduces the window
- **WHEN** an entry was reserved with an estimate of 1000 and `reconcile(handle, 400)` is called
- **THEN** `current()` reflects 400 for that entry

#### Scenario: reconcile with an unknown handle is a no-op
- **WHEN** `reconcile` is called with a handle that does not identify a live entry
- **THEN** no entry is modified and no error is thrown

### Requirement: Release removes a failed reservation
The token budget SHALL expose a `release(handle)` function that removes the consumption entry identified by
`handle`, so that a failed dispatch does not leave its charge in the window.

#### Scenario: release removes the entry
- **WHEN** an entry was reserved with 1000 and `release(handle)` is called
- **THEN** `current()` no longer includes those 1000 tokens

#### Scenario: release with an unknown handle is a no-op
- **WHEN** `release` is called with a handle that does not identify a live entry
- **THEN** no entry is modified and no error is thrown

### Requirement: A single shared budget instance is used across model instances
The token budget SHALL be a single shared instance that all model instances created by `createChatModel` with a
positive `rateLimit.maxTokensMinute`, and the `TokenBudget` middleware, pace against — not an independent budget
per instance.

#### Scenario: Two model instances share one window
- **WHEN** two `ChatOpenAI` instances are created from configs with the same `maxTokensMinute` and one dispatches
  tokens through the budget
- **THEN** the other instance's budget reflects the same consumed tokens (shared window)

#### Scenario: Shared budget is resettable for tests
- **WHEN** the shared budget is reset via the exported reset function
- **THEN** a fresh budget instance is used for subsequent model creation

