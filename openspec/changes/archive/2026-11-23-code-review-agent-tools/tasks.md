# Tasks

## 1. Tool Classification

- [x] 1.1 Add `"code-review"` to the `process` classification in `src/tools/index.js` and verify `getToolsForAgentTypes(["code-review"], TOOLS)` includes `process`
- [x] 1.2 Confirm `git` already includes `"code-review"` in `src/tools/index.js` and verify `getToolsForAgentTypes(["code-review"], TOOLS)` includes `git`

## 2. Spec & Documentation

- [x] 2.1 Update `openspec/specs/code-review-agent/spec.md` tool-access requirement to list `process` and `git` and add a shell-command scenario, and verify the spec delta matches
- [x] 2.2 Update `docs/FEATURES.md` `code-review` tool-access row to include `process` and `git`, and verify the row matches the actual tool set

## 3. Regression Test

- [x] 3.1 Add an assertion in `tests/unit/tool_index.test.js` that `getToolsForAgentTypes(["code-review"], TOOLS)` includes `process` and `git`, and verify the test passes

## 4. Verification

- [x] 4.1 Run `npm run test`, `npm run lint`, and `npm run coverage` and verify all pass with no regressions

## Workflow follow-up

- Archive the change after implementation is complete.
- Verify the archived result.
