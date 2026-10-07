## ADDED Requirements

### Requirement: Decision tool instruction injected when enabled
The `loadSystemPrompt` function in `src/memory/prompts.js` SHALL conditionally inject a decision tool instruction block into the system prompt based on `agent.decision.baseUrl`.

#### Scenario: Instruction injected when baseUrl configured
- **WHEN** `agent.decision.baseUrl` is a non-empty string
- **THEN** `loadSystemPrompt` SHALL replace the `<!-- DECISION_TOOL_INSTRUCTION -->` token in `SYSTEM_PROMPT.md` with the decision tool instruction block

#### Scenario: Instruction omitted when baseUrl empty
- **WHEN** `agent.decision.baseUrl` is an empty string or unset
- **THEN** `loadSystemPrompt` SHALL remove the `<!-- DECISION_TOOL_INSTRUCTION -->` token, leaving no instruction text and no token in the returned prompt

#### Scenario: Instruction is a standalone unnumbered block
- **WHEN** the decision tool instruction is injected
- **THEN** it SHALL appear as a standalone, unnumbered block near the top of the prompt, and SHALL NOT be part of a numbered directive list
