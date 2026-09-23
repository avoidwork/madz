## ADDED Requirements

### Requirement: Summarization middleware factory returns null when disabled
The system SHALL provide `createSummarizationMiddleware()` in
`src/provider/summarizationMiddleware.js` that returns `null` when the
`summarization` config section is absent or `enabled` is `false`, mirroring the
null-when-disabled contract of `createTokenBudgetMiddleware()`. The call site SHALL
spread the result conditionally so a disabled section is a true no-op.

#### Scenario: Disabled config returns null
- **WHEN** the factory is called with `enabled: false`
- **THEN** it returns `null`

#### Scenario: Missing section returns null
- **WHEN** the factory is called with an empty or missing summarization config
- **THEN** it returns `null`

#### Scenario: Enabled config returns a middleware
- **WHEN** the factory is called with a valid enabled config and a backend
- **THEN** it returns a middleware object rather than `null`

### Requirement: Custom middleware replaces the library default by name
The middleware returned by the factory SHALL be named exactly
`SummarizationMiddleware`, so that deepagents' `mergeMiddlewareStack()` replaces the
library default instance in place via `merged.set(name, mw)` rather than appending a
second summarization middleware. The system SHALL NOT use `excludedMiddleware` to
achieve this, because the exclusion filter runs after the merge and filters by name,
which would remove the custom replacement too and disable compaction entirely.

#### Scenario: Factory output carries the exact library name
- **WHEN** the factory returns a middleware
- **THEN** its `name` is exactly `SummarizationMiddleware`

#### Scenario: Effective stack holds exactly one summarization middleware
- **WHEN** the orchestrator is built with summarization enabled
- **THEN** the effective middleware stack contains exactly one entry named
  `SummarizationMiddleware`

#### Scenario: Custom instance is the one that survives
- **WHEN** the orchestrator is built with summarization enabled
- **THEN** the surviving `SummarizationMiddleware` entry is the instance produced by
  the madz factory, not the library default instance

#### Scenario: No summarization middleware is excluded via harness profile
- **WHEN** the orchestrator is built with summarization enabled
- **THEN** no `excludedMiddleware` entry naming `SummarizationMiddleware` is
  registered to achieve the replacement

### Requirement: Factory always passes keep explicitly
The factory SHALL always pass a `keep` option to the deepagents
`createSummarizationMiddleware()`. Omitting `keep` while supplying a `trigger`
silently changes the effective keep policy from the library fallback of 6 messages
to `DEFAULT_MESSAGES_TO_KEEP` of 20, because `defaultsComputed` becomes true as soon
as a trigger is supplied.

#### Scenario: keep defaults to six messages
- **WHEN** the factory is called with a trigger and no explicit `keep`
- **THEN** the options forwarded to the deepagents factory include
  `keep: { type: "messages", value: 6 }`

#### Scenario: explicit keep is forwarded unchanged
- **WHEN** the factory is called with `keep: { type: "messages", value: 10 }`
- **THEN** the forwarded options include that exact `keep` value

### Requirement: Factory always passes tool-argument truncation settings explicitly
The factory SHALL always pass a `truncateArgsSettings` option. Supplying a custom
`trigger` makes `applyModelDefaults()` early-return, so truncation settings are never
derived from model defaults, and an absent truncation trigger makes
`shouldTruncateArgs()` return `false` — silently disabling tool-argument truncation.

#### Scenario: Truncation stays enabled when only a trigger is configured
- **WHEN** the factory is called with a trigger and no explicit truncation settings
- **THEN** the forwarded options include a `truncateArgsSettings` whose trigger is
  `{ type: "messages", value: 20 }` and whose keep is `{ type: "messages", value: 20 }`

#### Scenario: Explicit truncation settings are forwarded
- **WHEN** the factory is called with explicit `truncateArgs` config
- **THEN** the forwarded `truncateArgsSettings` reflects the configured trigger, keep,
  and max length

### Requirement: Factory does not depend on undeclared packages
The factory SHALL NOT import `createMiddleware` from `langchain`. `langchain` is not
a declared dependency of madz — it resolves only transitively through `deepagents` —
so importing it would rely on an undeclared package. The factory SHALL only forward
options to the public `createSummarizationMiddleware` export of `deepagents`.

#### Scenario: No langchain import in the factory module
- **WHEN** `src/provider/summarizationMiddleware.js` is inspected
- **THEN** it contains no import from `langchain`

#### Scenario: deepagents export is used
- **WHEN** the factory builds a middleware
- **THEN** it calls `createSummarizationMiddleware` imported from `deepagents`

### Requirement: Middleware ordering preserves the token-budget invariant
The custom summarization middleware SHALL be inserted into the `middleware` array
passed to `createDeepAgent()` such that `TokenBudget` remains the last entry, so it
continues to compose innermost and observe the post-summarization message set.

#### Scenario: Token budget composes after summarization
- **WHEN** the orchestrator is built with both summarization and a token budget enabled
- **THEN** `TokenBudget` appears after `SummarizationMiddleware` in the effective stack

#### Scenario: Code interpreter ordering is unchanged
- **WHEN** the orchestrator is built with summarization enabled
- **THEN** `CodeInterpreterMiddleware` is still present in the effective stack

### Requirement: Compaction firing is proven at runtime, not at construction
The system SHALL include a test that asserts on the effective middleware stack handed
to `createDeepAgent()` — observable as `agent.options.middleware` — rather than only
asserting that the factory was called with certain arguments. A construction-only
assertion cannot detect a middleware that is built and then filtered out of the final
stack.

#### Scenario: Effective stack is asserted directly
- **WHEN** the orchestrator is constructed with summarization enabled
- **THEN** the test reads the effective middleware stack from the returned agent and
  asserts the custom summarization entry is present

#### Scenario: Construction-only assertion is insufficient
- **WHEN** a test asserts only that the deepagents factory was called with the
  expected options
- **THEN** that test alone does NOT satisfy this requirement

#### Scenario: No real API calls are made
- **WHEN** the runtime-proof test constructs the orchestrator
- **THEN** no network request to any LLM provider is issued

### Requirement: Proactive trigger coexists with reactive calibration
A configured proactive trigger SHALL NOT disable the library's reactive
`ContextOverflowError` path. The middleware's `tokenEstimationMultiplier` starts at 1
and is raised only when an overflow is observed, so a proactive trigger that prevents
overflows leaves the multiplier at 1 and the reactive path remains available as a
backstop for estimates that undershoot.

#### Scenario: Reactive path remains reachable when proactive trigger is set
- **WHEN** a proactive trigger is configured and a request still overflows because the
  token estimate undershot
- **THEN** the reactive overflow handling still runs and may raise the estimation
  multiplier

#### Scenario: Proactive trigger that never overflows leaves the multiplier at one
- **WHEN** a proactive trigger compacts reliably before the model's real window is
  reached
- **THEN** no overflow is observed and the estimation multiplier remains 1

### Requirement: Out-of-range thresholds degrade predictably
The system SHALL document and test the two predictable degradation modes of thresholds
that pass shape validation but are wrong for the live model: a trigger above the
model's real context window, and a `keep` larger than the live message count.

#### Scenario: Trigger above the real window degrades to today's behavior
- **WHEN** `trigger.value` exceeds the model's real input-token ceiling
- **THEN** proactive compaction never fires and behavior degrades to the reactive
  overflow path, without erroring

#### Scenario: Keep larger than the message count is a no-op
- **WHEN** `keep.value` is greater than or equal to the live message count
- **THEN** the cutoff index is zero, nothing is summarized, and no error is thrown

### Requirement: The deepagents factory is injectable for tests
The factory SHALL accept an injectable summarization-middleware factory, defaulting to
the real `createSummarizationMiddleware` from `deepagents`, so tests can capture the
exact forwarded options. This is required because `node --test` in this repository runs
without `--experimental-test-module-mocks`, so ES module imports cannot be stubbed.

#### Scenario: Injected factory receives the forwarded options
- **WHEN** the factory is called with an injected summarization-middleware factory
- **THEN** the injected factory receives the `trigger`, `keep`, and
  `truncateArgsSettings` values and its return value is what the madz factory returns

#### Scenario: Real factory is used by default
- **WHEN** the factory is called without an injected factory
- **THEN** the real `createSummarizationMiddleware` from `deepagents` is used

### Requirement: Subagent coverage boundary is documented
The system SHALL document that the configured summarization thresholds apply to the
orchestrator only. madz's subagent definitions carry no `mode` and no `middleware`,
so `buildSubagentMiddleware()` merges only `input.middleware` for non-forked
subagents and the top-level custom middleware does not reach them; subagents remain
on library defaults.

#### Scenario: Subagents remain on library defaults
- **WHEN** summarization is enabled for the orchestrator
- **THEN** subagent middleware stacks still contain the library default
  `SummarizationMiddleware` with the 170,000-token trigger and keep of 6

#### Scenario: Boundary is stated in documentation
- **WHEN** a developer reads the JSDoc or docs for the factory
- **THEN** it states explicitly that subagents are not covered by this config

### Requirement: Factory follows repository logging and error rules
The factory SHALL use `src/shared/logger.js` for any logging and SHALL NOT use
`console.log`, and SHALL NOT contain empty or silent catch blocks.

#### Scenario: No console usage
- **WHEN** `src/provider/summarizationMiddleware.js` is inspected
- **THEN** it contains no `console.` calls

#### Scenario: No empty catch blocks
- **WHEN** the factory module is inspected
- **THEN** every catch block handles or logs the error
