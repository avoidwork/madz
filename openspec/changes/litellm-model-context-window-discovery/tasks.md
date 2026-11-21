# Tasks

## 1. URL Construction

- [ ] 1.1 Add a `buildModelInfoUrl` helper to `src/provider/modelInfo.js` that constructs `{base}/model/info` from `base_url` (strip trailing slashes, append `/model/info` to the base host), and verify the unit test in `tests/unit/provider/modelInfo.test.js` passes.

## 2. LiteLLM Probe

- [ ] 2.1 Add a third probe candidate to `getModelContextLength` in `src/provider/modelInfo.js` that fetches `{base}/model/info`, matches the configured model by `model_name` (or `model_info.model_name`), and returns `max_input_tokens` (falling back to `max_output_tokens`) from the entry's `model_info` object, reusing the existing `sendKey`/`isInsecureRemote` auth logic and `positive()` helper; verify the new unit tests pass.
- [ ] 2.2 Add unit tests in `tests/unit/provider/modelInfo.test.js` covering the LiteLLM `/model/info` shape with `max_input_tokens`, the `max_output_tokens` fallback, and the no-context-field case (returns `undefined`); verify `npm run test` passes for the provider suite.

## 3. Verification

- [ ] 3.1 Run `npm run test` and `npm run coverage` and verify all tests pass with no regressions.
