# Tasks

## 1. Implementation

- [ ] 1.1 In `src/tools/index.js`, extend the `decision` entry in `TOOL_CLASSIFICATIONS` to `["orchestrator", "coding", "research", "code-review", "security-audit", "debug", "testing", "performance"]` and verify the array contains all eight agent types.

## 2. Tests

- [ ] 2.1 In `tests/unit/tool_index.test.js`, add a test asserting `getToolsForAgentTypes([agent], TOOLS)` includes `decision` for each of code-review, security-audit, debug, testing, and performance, and verify the test passes.
- [ ] 2.2 In `tests/unit/tool_index.test.js`, add a test asserting `getToolsForAgentTypes([agent], TOOLS)` excludes `decision` for search, documentation, textEditor, seoAnalyst, and translator, and verify the test passes.

## 3. Verification

- [ ] 3.1 Run `npm run test` and confirm all tests pass.
- [ ] 3.2 Run `npm run coverage` and confirm coverage is maintained.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
