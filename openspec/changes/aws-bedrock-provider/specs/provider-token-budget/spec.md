## MODIFIED Requirements

### Requirement: Middleware estimates cost via the model tokenizer
The `TokenBudget` middleware SHALL estimate the cost of a model request by calling `model.getNumTokensFromMessages(messages)` on the request's message array, plus the configured output budget (`maxTokens`). A `maxTokens` value of `-1` (unlimited) SHALL be treated as `0` (no output budget). For the Bedrock provider, the middleware SHALL reconcile the reservation to the Converse `usage_metadata` reported by the response.

#### Scenario: Middleware estimates cost from the model tokenizer
- **WHEN** the `TokenBudget` middleware estimates a request cost
- **THEN** it calls `model.getNumTokensFromMessages(messages)` on the request's message array and adds the output budget

#### Scenario: Middleware normalizes -1 maxTokens to zero
- **WHEN** the `TokenBudget` middleware estimates a request cost with `maxTokens: -1`
- **THEN** it treats `-1` as `0` (no output budget)

#### Scenario: Bedrock usage metadata reconciles the reservation
- **WHEN** a Bedrock model dispatch returns `usage_metadata`
- **THEN** the middleware reconciles the reservation to the actual token total reported by Converse
