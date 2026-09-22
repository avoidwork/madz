## MODIFIED Requirements

### Requirement: createChatModel wires the token-budget throttle
The `createChatModel()` function in `src/provider/openai.js` SHALL, when `rateLimit.maxTokensMinute` is greater than `0`, estimate the request token cost (input tokens plus the `maxTokens` output budget), reserve capacity on the **shared** token budget via an atomic `reserve(estimatedCost)` before invoking the model, and charge the window only for a successful dispatch. After a successful dispatch, the wrapper SHALL read `usage` (prompt + completion tokens) from the response and reconcile the reserved entry to the real total. On a failed dispatch, the wrapper SHALL release the reservation so the window is not charged.

#### Scenario: throttle is wired when maxTokensMinute is positive
- **WHEN** a config includes `rateLimit.maxTokensMinute: 100000`
- **THEN** the returned ChatOpenAI instance dispatches requests through the shared token-budget throttle

#### Scenario: throttle is disabled when maxTokensMinute is zero
- **WHEN** a config has `rateLimit.maxTokensMinute: 0` or omits it
- **THEN** the returned ChatOpenAI instance does not apply token-budget throttling

#### Scenario: successful dispatch reconciles to actual usage
- **WHEN** a dispatch succeeds and the response carries `usage` with prompt and completion tokens
- **THEN** the reserved budget entry is adjusted to the actual prompt + completion total

#### Scenario: failed dispatch does not consume budget
- **WHEN** a dispatch throws a non-rate-limit error
- **THEN** the reservation is released and `current()` does not include the failed request's tokens

#### Scenario: dispatch without usage keeps the estimate
- **WHEN** a dispatch succeeds but the response carries no `usage` field
- **THEN** the reserved estimate remains in the window (no crash, no double-charge)

## ADDED Requirements

### Requirement: createChatModel re-paces the 429 retry
The `createChatModel()` dispatch wrapper in `src/provider/openai.js` SHALL, on a `429` rate-limit error, release the failed attempt's reservation, sleep for the `retry-after` delay (or the default), call `waitForCapacity` again, and then re-dispatch. Only the attempt that succeeds SHALL be charged to the window.

#### Scenario: 429 retry waits for capacity again
- **WHEN** a dispatch fails with a `429` and the retry is scheduled
- **THEN** the wrapper calls `waitForCapacity` before re-dispatching, so the retry does not fire while the window is over capacity

#### Scenario: only the successful attempt is charged
- **WHEN** a dispatch fails with a `429` and the retry succeeds
- **THEN** the window contains exactly one charge (the successful attempt's tokens), not two

### Requirement: maxConcurrency semantics are documented
The `createChatModel()` JSDoc in `src/provider/openai.js` SHALL document that `rateLimit.maxConcurrency` is passed through to `ChatOpenAI` but is not used by the dispatch path to gate concurrent model calls; actual concurrency comes from parallel subagents, and the shared token budget is the enforcement point for the tokens-per-minute ceiling.

#### Scenario: JSDoc clarifies maxConcurrency
- **WHEN** reading the JSDoc of `createChatModel()`
- **THEN** the `rateLimit.maxConcurrency` entry states that it does not bound what the token budget sees and that the shared budget is the enforcement point
