# context-compaction Specification

## Purpose
TBD - created by archiving change automatic-context-compaction. Update Purpose after archive.
## Requirements
### Requirement: System detects LLM context length errors
The system SHALL detect when the LLM returns a 400 error indicating the conversation has exceeded the model's maximum context length. Error detection SHALL use a regex pattern that requires "context" to appear in the error message before matching "limit", preventing false positives on rate limit or other "limit" errors. The pattern SHALL match common error message formats such as "This model's maximum context length is 128000 tokens" and "maximum context length exceeded (limit: 8192)".

#### Scenario: Detect OpenAI-style context length error
- **WHEN** the LLM returns an error with message "This model's maximum context length is 128000 tokens"
- **THEN** the system extracts the max context length value (128000) and triggers compaction

#### Scenario: Detect variant error format
- **WHEN** the LLM returns an error with message "maximum context length exceeded (limit: 8192)"
- **THEN** the system extracts the max context length value (8192) and triggers compaction

#### Scenario: Non-context-length 400 error is not matched
- **WHEN** the LLM returns a 400 error with message "Invalid API key"
- **THEN** the system does NOT trigger compaction and propagates the error normally

### Requirement: Token budget calculation
The system SHALL calculate the available token budget for input context as `targetTokens = maxContextLength - maxTokens`, where `maxContextLength` is extracted from the error message and `maxTokens` is loaded from the provider configuration via `loadConfig()`.

#### Scenario: Calculate budget from OpenAI error
- **WHEN** error reports max context length of 128000 and config maxTokens is 4096
- **THEN** the target token budget is calculated as 123904

#### Scenario: Budget calculation uses config value
- **WHEN** the error reports max context length of 8192 and config maxTokens is 2048
- **THEN** the target token budget is calculated as 6144

### Requirement: Compaction tool preserves high-fidelity information
The `compactContext` tool SHALL rewrite the conversation history to fit within the `targetTokens` budget using a tiered retention strategy:
- Tier 1 (Always Retain): System prompt, most recent user message, last 3 assistant responses with tool calls
- Tier 2 (Summarize): Previous 5-10 exchanges summarized into concise bullet-point summaries
- Tier 3 (Drop): Oldest exchanges beyond the summary window are dropped

#### Scenario: Recent messages are always retained
- **WHEN** the conversation has 20 exchanges and compaction is triggered
- **THEN** the last 3 assistant responses with their tool calls are retained in full

#### Scenario: Older exchanges are summarized
- **WHEN** the conversation has 20 exchanges and compaction is triggered
- **THEN** exchanges beyond the last 3 are summarized into concise bullet-point summaries preserving key facts and decisions

#### Scenario: Oldest exchanges are dropped
- **WHEN** the conversation has 20 exchanges and compaction is triggered
- **THEN** exchanges older than the summary window are dropped entirely

### Requirement: Automatic retry after compaction
The system SHALL automatically retry the LLM call with the compacted conversation after compaction completes. If the retry also fails with a context length error, the system SHALL compact again with a reduced budget and retry, up to a maximum of 3 compaction iterations.

#### Scenario: Single compaction succeeds
- **WHEN** the first retry with compacted context succeeds
- **THEN** the system returns the LLM response to the user normally

#### Scenario: Multiple compaction iterations needed
- **WHEN** the first retry fails with another context length error
- **THEN** the system compacts again with a reduced budget and retries

#### Scenario: Maximum iterations reached without success
- **WHEN** 3 compaction iterations have been attempted without success
- **THEN** the system returns a user-facing error: "The conversation is too long. Please start a new session."

### Requirement: Compaction fallback for extreme cases
If compaction cannot reduce the context sufficiently to fit within the budget, the system SHALL progressively reduce the context:
1. Reduce summary window (fewer summarized exchanges)
2. Keep only system prompt + last user message
3. If that still exceeds the budget, return a user-facing error

#### Scenario: Fallback to minimal context
- **WHEN** even system prompt + last user message fits within the budget
- **THEN** the system uses this minimal context and retries

#### Scenario: Minimal context still exceeds budget
- **WHEN** even the minimal context (system prompt + last user message) exceeds the budget
- **THEN** the system returns a user-facing error: "The conversation is too long. Please start a new session."

### Requirement: Compaction tool is agent-callable
The `compactContext` tool SHALL be registered as a LangChain tool so the agent can invoke it when it encounters a context length error. The tool SHALL accept a `targetTokens` parameter and return the compacted messages.

#### Scenario: Agent calls compactContext tool
- **WHEN** the agent invokes the `compactContext` tool with `targetTokens: 50000`
- **THEN** the tool returns `{ ok: true, compactedMessages: [...], compactedTokenCount: <N>, strategy: "tiered-retention" }`

#### Scenario: CompactContext tool with insufficient budget
- **WHEN** the agent invokes the `compactContext` tool with a very small `targetTokens` value
- **THEN** the tool returns the most minimal context possible (system prompt + last message) or an error if even that exceeds the budget

