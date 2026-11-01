# Tasks

## 1. Fix the Ollama probe

- [ ] 1.1 Rewrite the Ollama branch in `src/provider/modelInfo.js` (lines 142-151) to scan `Object.entries(model_info)` for keys ending in `.effective_context_length` (return immediately) then `.context_length` (capture as native), preserving the `num_ctx` fallback; verify the corrected Ollama test at `tests/unit/provider/modelInfo.test.js:88` passes with the flat shape.
- [ ] 1.2 Correct the Ollama test at `tests/unit/provider/modelInfo.test.js:88` to the flat shape `{ model_info: { "gemma4.context_length": 131072 } }` and add a precedence test (both `gemma4.context_length` and `gemma4.effective_context_length` present, effective wins) and a neither-field case asserting `undefined`; verify all three pass.

## 2. Verify

- [ ] 2.1 Run `npm run test` and `npm run coverage` and confirm all tests pass with no regressions.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
