## ADDED Requirements

### Requirement: createChatModel returns a plain model instance
The `createChatModel()` function in `src/provider/openai.js` SHALL return a `ChatOpenAI` instance configured from
the provider config, and SHALL NOT install token-budget throttling by overriding instance methods. Budget
enforcement is the responsibility of the `TokenBudgetMiddleware` registered on the agent. The `createChatModel`
JSDoc SHALL state where enforcement lives.

#### Scenario: no instance-method override is installed
- **WHEN** `createChatModel` is called with `rateLimit.maxTokensMinute: 100000`
- **THEN** the returned instance's `invoke` and `stream` are the unmodified `ChatOpenAI` methods
- **AND** no `_rawInvoke` or `_rawStream` property is present on the instance

#### Scenario: budget enforcement is documented at the provider boundary
- **WHEN** reading the JSDoc of `createChatModel()`
- **THEN** it states that `maxTokensMinute` is enforced by `TokenBudgetMiddleware`, not by the model instance

### Requirement: maxConcurrency semantics are documented
The `createChatModel()` JSDoc in `src/provider/openai.js` SHALL document that `rateLimit.maxConcurrency` is
passed through to `ChatOpenAI` but is not used to gate concurrent model calls; actual concurrency comes from
parallel subagents, and the shared token budget is the enforcement point for the tokens-per-minute ceiling.

#### Scenario: JSDoc clarifies maxConcurrency
- **WHEN** reading the JSDoc of `createChatModel()`
- **THEN** the `rateLimit.maxConcurrency` entry states that it does not bound what the token budget sees and that
  the shared budget is the enforcement point

## REMOVED Requirements

### Requirement: createChatModel wires the token-budget throttle
**Reason:** The instance-property wrapper is orphaned by `bindTools()` → `withConfig()`, which constructs a new
model object before every agent dispatch. The wrapper never fires on the real dispatch path — verified by
reproduction against this repository's own module. Enforcement moves to `wrapModelCall` middleware, specified in
the `provider-token-budget` capability.

### Requirement: createChatModel attributes 429 errors to an exceeded token budget
**Reason:** 429 attribution is a property of the enforcement point, not of model construction. It is now
specified under `TokenBudgetMiddleware` in the `provider-token-budget` capability.
