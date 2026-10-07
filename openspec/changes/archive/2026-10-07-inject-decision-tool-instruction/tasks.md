## 1. Prompt Changes

- [x] 1.1 Add the `<!-- DECISION_TOOL_INSTRUCTION -->` token to `prompts/SYSTEM_PROMPT.md` near the top as a standalone unnumbered block
- [x] 1.2 Define the decision tool instruction text that replaces the token when the tool is enabled

## 2. Implementation

- [x] 2.1 In `src/memory/prompts.js`, read `config.agent.decision.baseUrl` in `loadSystemPrompt()`
- [x] 2.2 Replace the token with the instruction when `baseUrl` is non-empty, or with an empty string when empty/unset

## 3. Tests

- [x] 3.1 Add a unit test asserting the instruction is injected when `agent.decision.baseUrl` is set
- [x] 3.2 Add a unit test asserting the token is removed and no instruction remains when `agent.decision.baseUrl` is empty/unset

## 4. Verification

- [x] 4.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm everything passes
