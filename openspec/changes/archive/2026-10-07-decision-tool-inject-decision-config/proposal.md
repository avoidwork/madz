## Why

The `decision` tool is registered and callable but always fails with a misleading "not configured" error, even when `agent.decision.baseUrl` is set in config. The root cause is that `decisionConfig` is built during registration (in `buildToolConfig`) but never passed to the tool at invoke time, so `decisionImpl` reads `options.decisionConfig` as `undefined` and returns the "not configured" error.

## What Changes

- In `src/tools/index.js`, the `decision` case in `buildToolConfig` will no longer push the bare static `TOOLS.decision` instance.
- Instead, it will wrap `decisionImpl` in a closure that injects `decisionConfig` from `runtimeOptions.decisionConfig` at registration, so the configured decision endpoint is actually used at invoke time.
- The registration gate remains unchanged: the tool is only registered when `hasAllPerms` and `runtimeOptions.decisionConfig?.baseUrl` are present.
- Add a regression test in `tests/unit/tools/decision.test.js` verifying `decisionImpl` receives a populated `decisionConfig` when invoked through the registered tool.

## Capabilities

### New Capabilities
<!-- None — this is a bug fix to an existing capability. -->

### Modified Capabilities
- `decision-tool`: The `decision` tool SHALL receive the configured `decisionConfig` at invoke time so it uses the configured `agent.decision.baseUrl` instead of failing with a "not configured" error.

## Impact

- `src/tools/index.js` — `buildToolConfig`; the `decision` case wraps `decisionImpl` to inject `decisionConfig`.
- `src/tools/decision/index.js` — `decisionImpl(input, options)` reads `options.decisionConfig`; unchanged.
- `src/agent/deepAgents.js` — calls `buildToolConfig(buildOptions)`; `runtimeOptions` is never threaded into tool invocation, which is the bug.
- `tests/unit/tools/decision.test.js` — add a regression test.

## Non-goals

- No change to `decisionImpl`'s core logic, schema, or the Ollama call path.
- No change to the registration gate or permission model.
- No change to the config schema for `agent.decision`.
