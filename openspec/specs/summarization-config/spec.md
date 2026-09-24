# summarization-config Specification

## Purpose
TBD - created by archiving change configurable-summarization-thresholds. Update Purpose after archive.
## Requirements
### Requirement: Summarization config is validated by a Zod schema
The `summarization` config section SHALL be validated by a Zod schema (`SummarizationSchema`) in `src/config/schemas/summarization.js`, registered in `ConfigSchema` in `src/config/config.js`. The schema SHALL expose `enabled` (boolean, default `false`), `trigger` (discriminated on `type: "tokens" | "messages" | "fraction"` with a positive `value`), `keep` (same shape), and optional `historyPathPrefix`.

#### Scenario: Valid token trigger config is accepted
- **WHEN** a config specifies `summarization.enabled: true` with `trigger: { type: "tokens", value: 28000 }` and `keep: { type: "messages", value: 10 }`
- **THEN** the schema validates successfully

#### Scenario: Valid message trigger config is accepted
- **WHEN** a config specifies `trigger: { type: "messages", value: 20 }` and `keep: { type: "messages", value: 10 }`
- **THEN** the schema validates successfully

#### Scenario: Valid fraction trigger config is accepted
- **WHEN** a config specifies `trigger: { type: "fraction", value: 0.5 }` and `keep: { type: "messages", value: 10 }`
- **THEN** the schema validates successfully

#### Scenario: Zero trigger value is rejected
- **WHEN** a config specifies `trigger: { type: "tokens", value: 0 }`
- **THEN** the schema rejects the config with a validation error

#### Scenario: Negative trigger value is rejected
- **WHEN** a config specifies `trigger: { type: "tokens", value: -100 }`
- **THEN** the schema rejects the config with a validation error

#### Scenario: Wrong trigger type is rejected
- **WHEN** a config specifies `trigger: { type: "chars", value: 100 }`
- **THEN** the schema rejects the config with a validation error

#### Scenario: Unknown keys are rejected
- **WHEN** a config specifies an unknown key inside `summarization`
- **THEN** the schema rejects the config with a validation error

#### Scenario: Absent section parses to documented defaults
- **WHEN** a config is parsed without a `summarization` section
- **THEN** the schema defaults to `enabled: false` and the section is a no-op

### Requirement: Summarization middleware factory passes trigger and keep explicitly
The middleware factory (`src/provider/summarizationMiddleware.js`) SHALL return `createSummarizationMiddleware({ backend, trigger, keep, historyPathPrefix })` from `deepagents` when `enabled` is true, or `null` when `enabled` is false. It SHALL always pass `keep` explicitly to avoid the library default shift from 6 to 20 messages.

#### Scenario: Enabled config returns the middleware
- **WHEN** `enabled` is true with a configured `trigger` and `keep`
- **THEN** the factory returns a `SummarizationMiddleware` instance with the configured `trigger` and `keep`

#### Scenario: Disabled config returns null
- **WHEN** `enabled` is false or the section is absent
- **THEN** the factory returns `null` and the entry is spread conditionally (a true no-op)

#### Scenario: Trigger without keep is not allowed
- **WHEN** the factory is called with a `trigger` but no `keep`
- **THEN** the factory passes an explicit `keep` (never relying on the library default of 20)

### Requirement: Custom middleware is wired into the orchestrator stack
The custom `SummarizationMiddleware` SHALL be inserted into the `middleware` array in `src/agent/deepAgents.js` **before** `tokenBudgetMiddleware`, named exactly `SummarizationMiddleware` so the same-name merge displaces the library default.

#### Scenario: Middleware is inserted before token budget
- **WHEN** the orchestrator is created with summarization enabled
- **THEN** the custom `SummarizationMiddleware` appears in the `middleware` array before `TokenBudget`

#### Scenario: Unset config leaves the stack unchanged
- **WHEN** the orchestrator is created without summarization config
- **THEN** the `middleware` array contains only `createCodeInterpreterMiddleware()` and the conditional `tokenBudgetMiddleware`, matching today's behavior

### Requirement: Custom middleware is proven to fire at runtime
The implementation SHALL include a runtime probe (log line or assertion) that proves the custom `SummarizationMiddleware` fires at the configured value — not the 170k default — and that the library default `SummarizationMiddleware` is genuinely absent from the effective stack. Constructing the middleware is not evidence it is reached.

#### Scenario: Compaction fires at the configured value
- **WHEN** a conversation crosses the configured trigger threshold
- **THEN** the runtime probe records compaction at the configured value, not the 170k default

#### Scenario: Library default is absent from the effective stack
- **WHEN** the orchestrator is created with summarization enabled
- **THEN** the runtime probe shows the library default `SummarizationMiddleware` is not in the effective middleware stack

### Requirement: Subagent middleware stack behavior is documented and verified
The implementation SHALL document and verify whether the custom `SummarizationMiddleware` applies to subagents or only the orchestrator.

#### Scenario: Subagent stack behavior is documented
- **WHEN** the implementation is complete
- **THEN** the docs/JSDoc state whether the custom middleware applies to subagents or only the orchestrator

### Requirement: Offload filename scheme is confirmed empirically
The implementation SHALL confirm the offload filename scheme empirically (write a transcript, inspect the sandbox filesystem) and record the confirmed scheme in docs/JSDoc.

#### Scenario: Offload filename scheme is recorded
- **WHEN** the implementation is complete
- **THEN** the docs/JSDoc record the empirically confirmed offload filename scheme

