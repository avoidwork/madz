## MODIFIED Requirements

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

#### Scenario: Rate limit error is not matched
- **WHEN** the LLM returns an error with message "rate limit: 429" or "rate limit exceeded: 100 requests per minute"
- **THEN** the system does NOT trigger compaction and propagates the error normally