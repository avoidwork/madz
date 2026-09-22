## ADDED Requirements

### Requirement: Atomic reserve prevents concurrent overshoot
The token budget SHALL expose a `reserve(estimatedTokens)` function that atomically waits for capacity and records the consumption under a single lock/queue, so that concurrent callers cannot each pass the capacity check and overshoot the window. `reserve` SHALL return a handle identifying the recorded entry.

#### Scenario: Concurrent reserves do not overshoot the budget
- **WHEN** multiple concurrent `reserve` calls each request an amount such that only one fits within the remaining window capacity
- **THEN** only the calls that fit are admitted immediately; the rest wait until the window drains, and the sum of admitted tokens never exceeds `maxTokensMinute` within the window

#### Scenario: reserve returns a handle for the recorded entry
- **WHEN** `reserve(tokens)` is called
- **THEN** it resolves to a handle that identifies the specific consumption entry recorded

#### Scenario: reserve is a no-op when disabled
- **WHEN** `maxTokensMinute` is `0`
- **THEN** `reserve` resolves immediately with a null handle and records nothing

### Requirement: Reconcile adjusts a consumed entry to actual usage
The token budget SHALL expose a `reconcile(handle, actualTokens)` function that adjusts the consumption entry identified by `handle` to `actualTokens`, replacing the pre-dispatch estimate with the real token total reported by the API.

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
The token budget SHALL expose a `release(handle)` function that removes the consumption entry identified by `handle`, so that a failed dispatch does not leave its charge in the window.

#### Scenario: release removes the entry
- **WHEN** an entry was reserved with 1000 and `release(handle)` is called
- **THEN** `current()` no longer includes those 1000 tokens

#### Scenario: release with an unknown handle is a no-op
- **WHEN** `release` is called with a handle that does not identify a live entry
- **THEN** no entry is modified and no error is thrown

### Requirement: A single shared budget instance is used across model instances
All model instances created by `createChatModel` with `rateLimit.maxTokensMinute > 0` SHALL pace against a single shared token budget instance, not an independent budget per instance.

#### Scenario: Two model instances share one window
- **WHEN** two `ChatOpenAI` instances are created from configs with the same `maxTokensMinute` and one dispatches tokens through its budget
- **THEN** the other instance's budget reflects the same consumed tokens (shared window)

#### Scenario: Shared budget is resettable for tests
- **WHEN** the shared budget is reset (e.g. via an exported reset function)
- **THEN** a fresh budget instance is used for subsequent model creation
