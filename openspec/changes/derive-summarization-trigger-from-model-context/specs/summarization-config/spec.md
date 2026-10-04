## MODIFIED Requirements

### Requirement: Summarization trigger is derived from model context length
The system SHALL derive the summarization trigger from the resolved model context length at init. In `createDeepAgentsOrchestrator` (`src/agent/deepAgents.js`), after the model is created and before `createSummarizationMiddlewareFromConfig` is called, the system SHALL resolve the context length via `getModelContextLength(providerConfig)` and compute `triggerTokens = Math.floor(contextLength * 0.8)`. It SHALL pass the resolved `{ type: "tokens", value: triggerTokens }` trigger to the middleware, overriding the configured token value. When the context length cannot be resolved, the system SHALL fall back to the configured token value. The 80% is hardcoded; no config schema change is introduced.

#### Scenario: Context length resolves and overrides the configured trigger
- **WHEN** `getModelContextLength(providerConfig)` returns a usable context length
- **THEN** the middleware receives `{ type: "tokens", value: Math.floor(contextLength * 0.8) }` as the trigger, overriding the configured token value

#### Scenario: Context length cannot be resolved and falls back to config
- **WHEN** `getModelContextLength(providerConfig)` returns `undefined`
- **THEN** the middleware receives the configured token value as the trigger, unchanged

#### Scenario: Summarization is disabled and no override is applied
- **WHEN** `summarization.enabled` is false or the section is absent
- **THEN** the middleware factory returns `null` and no trigger override is applied
