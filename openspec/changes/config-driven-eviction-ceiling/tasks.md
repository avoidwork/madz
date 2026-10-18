# Tasks — config-driven-eviction-ceiling

## 1. Config clamp

- [ ] 1.1 Add `MIN_IMAGE_MAX_SIZE` / `MAX_IMAGE_MAX_SIZE` constants and `.min()`/`.max()` to `maxSize` in `src/config/schemas/image.js`, keeping `.int().positive().default(100000)`.
- [ ] 1.2 Add `tests/unit/config/schemas/image.test.js`: default preserved; below-minimum rejected; above-maximum rejected; non-integer / non-positive rejected; a valid custom value accepted.

## 2. Eviction-aware filesystem middleware module

- [ ] 2.1 Create `src/agent/filesystemMiddleware.js` exporting `deriveToolTokenLimitBeforeEvict(config)` — `Math.ceil((maxSize + ENVELOPE_HEADROOM) / 4)` from `config.image?.maxSize`, falling back to `100000` for absent/zero/non-finite/non-number values, clamped to `[MIN_CEILING, MAX_CEILING]`, always a finite positive integer.
- [ ] 2.2 Export `resolveProfileFilesystemTools(model)` — re-implements the library's `resolveHarnessProfile` lookup order (`getHarnessProfile` exact `provider:model` → `providerHint:identifierHint` → bare identifier with colon → bare provider → `EMPTY_HARNESS_PROFILE`) and `computeProfileFilesystemTools` (`undefined` when nothing excluded; otherwise filtered list with `read_file` prepended). Comment each with the dist line it mirrors.
- [ ] 2.3 Export `createEvictionAwareFilesystemMiddleware({ backend, model, config, permissions = [] })` — calls `createFilesystemMiddleware({ backend, permissions, tools: resolveProfileFilesystemTools(model), toolTokenLimitBeforeEvict })` and logs the derived ceiling at `debug` (no PII).
- [ ] 2.4 Add `tests/unit/agent/filesystemMiddleware.test.js`:
  - derived ceiling for default `image.maxSize` (→ `25032`), a custom value (`200000` → `50032`), and unset/zero/`NaN`/`Infinity`/string/negative (→ finite positive integer, never falsy);
  - `name === "FilesystemMiddleware"` on the replacement;
  - contributed tool set equals a freshly built library instance's tool set for the same profile (all eight tools when nothing is excluded; narrowed when a profile excludes `execute`/`grep`/`ls`);
  - `permissions: []` and the derived ceiling reach `createFilesystemMiddleware` (spy via a profile registered for a synthetic model id);
  - profile resolution for a model with no profile → `tools` is `undefined`.

## 3. Orchestrator wiring

- [ ] 3.1 In `createDeepAgentsOrchestrator`, build the replacement with the in-scope `config`, the shared `backend`, and the orchestrator `model`; register it in `createDeepAgent({ middleware: [...] })` with a comment explaining same-name displacement (mirroring the `SummarizationMiddleware` comment at `src/agent/deepAgents.js:441`).
- [ ] 3.2 Confirm no duplicate `FilesystemMiddleware` is stacked (assert via the middleware list the agent is built with, or by construction-level name-uniqueness test).

## 4. Subagent inheritance

- [ ] 4.1 In `createSubagentDefinitions`, attach `middleware: [createEvictionAwareFilesystemMiddleware({ backend, model: agentModel, config })]` to every definition. Add an optional `backend` parameter defaulting to `createCoreBackend()` so callers/tests can inject one.
- [ ] 4.2 Pass the shared `backend` from `createDeepAgentsOrchestrator` into `createSubagentDefinitions` so subagents and the orchestrator share one backend.
- [ ] 4.3 Extend `tests/unit/deepAgents.test.js`: every one of the 12 definitions carries a `middleware` entry named `"FilesystemMiddleware"`; `name`/`description`/`model`/`tools`/`skills` are otherwise unchanged.

## 5. Integration — eviction behaviour

- [ ] 5.1 Add `tests/integration/evictionCeiling.test.js` driving the real `readImage` result through the replacement middleware's `wrapToolCall`:
  - base64 just under `image.maxSize` → content is still parseable JSON with `ok: true` and non-empty `data` (not the eviction template);
  - base64 at exactly the ceiling → not evicted;
  - base64 above the ceiling → evicted to `/large_tool_results/…` rather than blowing the context window;
  - `image.maxSize` unset → default ceiling applies.
- [ ] 5.2 Pair with `ImageDispatch`: feed the surviving `ToolMessage` through `createImageDispatchMiddleware`'s `wrapModelCall` and assert an `image_url` vision block is injected end to end.
- [ ] 5.3 Assert the library-default middleware (no `toolTokenLimitBeforeEvict`) *does* evict the same payload, proving the test would fail without the fix.

## 6. Verification

- [ ] 6.1 `npm run lint` passes (oxlint + oxfmt).
- [ ] 6.2 `npm test` passes.
- [ ] 6.3 `npm run coverage` regenerated; changed files covered.
- [ ] 6.4 `npm start` boots without crashing.
