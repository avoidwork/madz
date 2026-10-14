## MODIFIED Requirements

### Requirement: Summarization middleware factory passes trigger and keep explicitly
The middleware factory (`src/provider/summarizationMiddleware.js`) SHALL return `createSummarizationMiddleware({ backend, trigger, keep })` from `deepagents` when `enabled` is true, or `null` when `enabled` is false. It SHALL always pass `keep` explicitly to avoid the library default shift from 6 to 20 messages. The factory SHALL also accept `model` and `maxTokens` options and use them to perform a preemptive context-window estimate before dispatch.

#### Scenario: Enabled config returns the middleware
- **WHEN** `enabled` is true with a configured `trigger` and `keep`
- **THEN** the factory returns a `SummarizationMiddleware` instance with the configured `trigger` and `keep`

#### Scenario: Disabled config returns null
- **WHEN** `enabled` is false or the section is absent
- **THEN** the factory returns `null` and the entry is spread conditionally (a true no-op)

#### Scenario: Trigger without keep is not allowed
- **WHEN** the factory is called with a `trigger` but no `keep`
- **THEN** the factory passes an explicit `keep` (never relying on the library default of 20)

#### Scenario: Factory accepts model and maxTokens
- **WHEN** the factory is called with `model` and `maxTokens` options
- **THEN** it uses them to estimate the preemptive context-window cost before dispatch
