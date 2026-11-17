# Spec Delta

## ADDED Requirements

### Requirement: Silent mode directive injected when enabled
The `loadSystemPrompt` function in `src/memory/prompts.js` SHALL swap the body of rule 3.1 in the system prompt based on `agent.silent`.

#### Scenario: Directive injected when silent enabled
- **WHEN** `agent.silent` is `true`
- **THEN** `loadSystemPrompt` SHALL replace the `<!-- RULE_31_INSTRUCTION -->` token in `SYSTEM_PROMPT.md` with the silent-mode directive instructing the orchestrator to remain silent except when delivering its final response

#### Scenario: Default body used when silent disabled
- **WHEN** `agent.silent` is `false` or unset
- **THEN** `loadSystemPrompt` SHALL replace the `<!-- RULE_31_INSTRUCTION -->` token with the default rule 3.1 body ("Be concise..."), leaving no token in the returned prompt

#### Scenario: Directive is the body of rule 3.1
- **WHEN** the silent-mode directive is injected
- **THEN** it SHALL appear as the body of rule 3.1 in the Delivery subsection of `DELIVERY & OUTPUT`, replacing the default "Be concise" text, and SHALL NOT be a separate numbered or unnumbered block

### Requirement: Silent sampling instruction variant
When `agent.silent` is `true`, the sampling tool instruction injected into the system prompt SHALL omit the sentence that tells the user when a memory is captured, while still instructing the agent to capture memories.

#### Scenario: Silent sampling variant omits announcement
- **WHEN** `agent.silent` is `true` and `agent.sampling` is enabled
- **THEN** the injected sampling instruction SHALL NOT contain the sentence telling the user when a memory is captured, but SHALL still instruct the agent to capture memories

#### Scenario: Full sampling instruction when not silent
- **WHEN** `agent.silent` is `false` and `agent.sampling` is enabled
- **THEN** the injected sampling instruction SHALL contain the sentence telling the user when a memory is captured
