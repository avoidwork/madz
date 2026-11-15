# Tasks

## 1. Config Schema

- [x] 1.1 Create `src/config/schemas/loopDetection.js` exporting `LoopDetectionSchema` (fields: `enabled` default true, `windowSize` default 10, `threshold` default 2, `escalationCount` default 3, `escalationWindowMs` default 60000) following the `summarization.js` `.strict().default({})` pattern. Verify the module imports and exports cleanly with `node -e "import('./src/config/schemas/loopDetection.js').then(m => console.log(Object.keys(m)))"`.
- [x] 1.2 Register `LoopDetectionSchema` in `src/config/schemas/config.js` (add to `ConfigSchema`) and export it from `src/config/schemas/index.js`. Verify `node -e "import('./src/config/config.js').then(m => console.log(!!m.ConfigSchema))"` succeeds.
- [x] 1.3 Add a `loopDetection:` section to `config.yaml` with the production-safe defaults. Verify `node -e "import('./src/config/loader.js').then(m => console.log(m.loadConfig().loopDetection))"` returns the defaults.

## 2. Middleware Implementation

- [x] 2.1 Create `src/provider/loopDetectionMiddleware.js` exporting `createLoopDetectionMiddleware(options)`. It reads config (windowSize, threshold, escalationCount, escalationWindowMs) and returns `null` when disabled. Verify the module exports the factory with `node -e "import('./src/provider/loopDetectionMiddleware.js').then(m => console.log(typeof m.createLoopDetectionMiddleware))"`.
- [x] 2.2 Implement content extraction and hashing: extract message text and reasoning content from the last message (reusing `turn.js` patterns), hash each independently with `node:crypto` sha256. Verify with a unit test that identical content produces identical hashes and empty content produces no hash.
- [x] 2.3 Implement per-thread rolling hash windows (message and reasoning) bounded to `windowSize`, keyed by `thread_id`. Verify with a unit test that windows evict the oldest hash and are independent per thread.
- [x] 2.4 Implement loop detection: flag a loop when a hash appears more than `threshold` times within the window. Verify with a unit test that a hash above threshold triggers detection and at/below threshold does not.
- [x] 2.5 Implement the `beforeModel` hook: on detection, return `{ messages: [new HumanMessage("You're looping")] }`. Verify with a unit test that a detected loop returns the injected message.
- [x] 2.6 Implement escalation: track injection timestamps per thread; when `escalationCount` injections occur within `escalationWindowMs`, invoke the `onCompact` callback instead of injecting. Verify with a unit test that 3 injections within the window trigger `onCompact` and that the window expiry resets the counter.

## 3. Orchestrator Registration

- [x] 3.1 In `src/agent/deepAgents.js`, import `createLoopDetectionMiddleware` and create it with an `onCompact` callback wired via closure to `agent.compactContext` (mirroring `compactOnContextWindowExceeded`). Verify the middleware is created and the callback is set after the agent exists.
- [x] 3.2 Add the loop-detection middleware to the `middleware` array in `createDeepAgentsOrchestrator`. Verify the agent builds without error by running `node -e "import('./src/agent/deepAgents.js').then(m => console.log(typeof m.createDeepAgentsOrchestrator))"`.

## 4. Tests

- [x] 4.1 Add `tests/unit/provider/loopDetectionMiddleware.test.js` covering: hash windowing, threshold detection (>2), independent message vs reasoning tracking, escalation counter (3 within 60s), edge cases (empty content, single-message window, changing content no false positive, reasoning-only loop, window expiry). Verify `node --test tests/unit/provider/loopDetectionMiddleware.test.js` passes.

## 5. Verification

- [x] 5.1 Run `npm run test` and confirm the full suite passes.
- [x] 5.2 Run `npm run lint` and confirm no lint or formatting errors.
- [x] 5.3 Run `npm run coverage` and confirm coverage is maintained (no regression in `coverage.txt`).

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
