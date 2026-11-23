# Tasks

## 1. Config Knob

- [ ] 1.1 Add a `subagent` boolean field (default `true`) to `LoopDetectionSchema` in `src/config/schemas/loopDetection.js` and verify `node -e "import('./src/config/schemas/loopDetection.js').then(m => console.log(m.LoopDetectionSchema.parse({}).subagent))"` prints `true`
- [ ] 1.2 Add `subagent: true` under the `loopDetection:` section of `config.yaml` and verify `node -e "import('./src/config/loader.js').then(m => console.log(m.loadConfig().loopDetection.subagent))"` prints `true`

## 2. Wire Config Through index.js

- [ ] 2.1 In `index.js` `runAgent`, read `config.loopDetection.subagent` and pass it through to `consumeStream` via the `loopDetector` options, and verify the module loads cleanly with `node -e "import('./index.js').then(() => console.log('ok'))"` (or the project's start check)

## 3. Feed Subagent Reasoning to the Detector

- [ ] 3.1 In `src/stream/consume.js` `drainStream`, relax the `if (!isSubagent)` guards around the `loopDetector.push("reasoning", ...)` calls so subagent reasoning is fed to the detector, keyed by the `tools:<id>` namespace segment, and verify the existing loop-detector unit tests still pass
- [ ] 3.2 Manage the subagent turn lifecycle: extend `endMessage`/`end`/`reset` handling so a subagent's reasoning turn is closed and its detector state released when the subagent turn ends, and verify the existing loop-detector turn-end tests still pass

## 4. Tests

- [ ] 4.1 Extend `tests/unit/stream/loopDetectorMessageEnd.test.js` and/or `loopDetectorTurnEnd.test.js` with a subagent-namespace case asserting a repeating subagent reasoning stream is flagged and a varied one is not, plus the threshold boundary, and verify `node --test tests/unit/stream/loopDetectorMessageEnd.test.js tests/unit/stream/loopDetectorTurnEnd.test.js` passes
- [ ] 4.2 Add a config-schema test for the `subagent` flag in `tests/unit/stream/loopDetectorWindow.test.js` and verify `node --test tests/unit/stream/loopDetectorWindow.test.js` passes

## 5. Verification

- [ ] 5.1 Run `npm run test`, `npm run lint`, and `npm run coverage` and confirm all pass with no regressions
