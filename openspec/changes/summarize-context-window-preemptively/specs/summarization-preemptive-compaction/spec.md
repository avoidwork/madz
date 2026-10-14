## ADDED Requirements

### Requirement: Summarization middleware estimates context cost preemptively
The summarization middleware SHALL estimate the total cost of a model request (input tokens + tool tokens + expected output tokens) before dispatching, using the model's own tokenizer via `model.getNumTokensFromMessages(messages)`. The estimate SHALL mirror `estimateCost()` in `src/provider/tokenBudgetMiddleware.js`.

#### Scenario: Estimate uses the model tokenizer for input
- **WHEN** the middleware is about to dispatch a request with messages
- **THEN** it calls `model.getNumTokensFromMessages(messages)` to compute the input token count

#### Scenario: Estimate adds the configured output budget
- **WHEN** the middleware estimates the total cost
- **THEN** it adds the configured `maxTokens` (output budget) to the input token count, so a long response is accounted for

#### Scenario: Output budget of -1 is treated as zero
- **WHEN** `maxTokens` is `-1` (unlimited)
- **THEN** the estimate treats it as 0 so the total is not off by one

### Requirement: Summarization middleware compacts when total exceeds the context window
The summarization middleware SHALL compact the conversation before dispatch when the estimated total cost (input + expected output) would exceed the model's context window, rather than waiting for a 400 context-window error.

#### Scenario: Input plus output exceeds the window
- **WHEN** the estimated total (input + output) exceeds the model's context window
- **THEN** the middleware compacts the conversation before the request is sent

#### Scenario: Input plus output fits within the window
- **WHEN** the estimated total (input + output) is within the model's context window
- **THEN** the middleware dispatches the request without preemptive compaction

#### Scenario: Model lacks a tokenizer method
- **WHEN** the model does not expose `getNumTokensFromMessages`
- **THEN** the middleware skips the preemptive estimate and preserves the existing trigger-based behavior
