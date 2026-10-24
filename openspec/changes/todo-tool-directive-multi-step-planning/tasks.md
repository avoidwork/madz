## 1. Add Directive to System Prompt

- [x] 1.1 Add a new numbered rule (45) under `#### Tool Call Discipline` in `prompts/SYSTEM_PROMPT.md` instructing the agent to use the `todo` tool for planning multi-step work and chained skills execution.
- [x] 1.2 Ensure the directive specifies the lifecycle: clear the todo list (`todo clear` with `confirm: true`) when starting new work; add new items without clearing when continuing chained work; clear the list when all work is done.

## 2. Add Unit Test

- [x] 2.1 Extend `tests/unit/prompts.test.js` with a test that writes a `SYSTEM_PROMPT.md` fixture, calls `loadSystemPrompt`, and asserts the directive substring (e.g., "use the `todo` tool") is present.

## 3. Verify

- [x] 3.1 Run `npm run test` and confirm all tests pass.
- [x] 3.2 Run `npm run lint` and confirm no lint errors.
