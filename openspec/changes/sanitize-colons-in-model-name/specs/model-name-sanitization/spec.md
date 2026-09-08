## ADDED Requirements

### Requirement: Model name colon sanitization
The system SHALL replace colons with hyphens in the model name when constructing the harness profile registry key, ensuring the key has exactly one colon (the `providerName:modelName` delimiter). The original model name value SHALL be preserved for API calls.

#### Scenario: Model name with single colon
- **WHEN** the model name contains a single colon (e.g., `qwen3.8:27b-mlx`)
- **THEN** the registry key SHALL use a hyphen in place of the colon (e.g., `openai:qwen3.8-27b-mlx`)
- **AND** the original model name SHALL remain unchanged for API calls

#### Scenario: Model name with multiple colons
- **WHEN** the model name contains multiple colons (e.g., `a:b:c`)
- **THEN** all colons SHALL be replaced with hyphens (e.g., `openai:a-b-c`)

#### Scenario: Model name with leading or trailing colons
- **WHEN** the model name has leading or trailing colons (e.g., `:model:`)
- **THEN** those colons SHALL also be replaced with hyphens (e.g., `openai:-model-`)

#### Scenario: Model name without colons
- **WHEN** the model name contains no colons (e.g., `gpt-4o`)
- **THEN** the registry key SHALL be identical to the pre-fix behavior (e.g., `openai:gpt-4o`)
