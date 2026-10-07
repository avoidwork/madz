## 1. Implementation

- [ ] 1.1 In `src/tools/index.js`, modify the `decision` case in `buildToolConfig` to wrap `decisionImpl` in a closure that injects `decisionConfig` from `runtimeOptions.decisionConfig` at registration, instead of pushing the bare static `TOOLS.decision` instance.
- [ ] 1.2 Ensure the registration gate still requires `hasAllPerms` and `runtimeOptions.decisionConfig?.baseUrl` before registering the wrapped tool.

## 2. Tests

- [ ] 2.1 Add a regression test in `tests/unit/tools/decision.test.js` that verifies `decisionImpl` receives a populated `decisionConfig` when invoked through the registered tool (via `buildToolConfig`).

## 3. Verification

- [ ] 3.1 Run `npm run test` and confirm all tests pass.
- [ ] 3.2 Run `npm run coverage` and confirm coverage is maintained.
