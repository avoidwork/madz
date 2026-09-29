## 1. Implementation

- [x] 1.1 In `src/agent/agentDefinitions.js`, change the catch block in `createAgentDefinition` to log the prompt-load failure at `logger.warn` instead of `logger.debug`, so a missing or unreadable prompt file is visible at the default log level.
- [x] 1.2 Preserve the `try/catch` structure so module load does not crash and the agent is still returned with `systemPrompt: ""` (warn-and-continue).

## 2. Tests

- [x] 2.1 Add a unit test that stubs `readFile` to reject and asserts the prompt-load failure is surfaced (either the agent definition is rejected or a `warn`-level log is emitted).
- [x] 2.2 Add a regression test verifying that a missing prompt file produces a warning at `warn` level (or throws), rather than silently degrading at `debug` level.

## 3. Verification

- [x] 3.1 Run `npm run test` and confirm all tests pass.
- [x] 3.2 Run `npm run lint` and confirm lint passes.
- [x] 3.3 Run `npm run coverage` and confirm coverage is maintained.
