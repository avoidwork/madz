## 1. Fix shutdown test telemetry noise

- [x] 1.1 Read `tests/unit/shutdown.test.js` and `src/session/shutdown.js` to understand the current test structure
- [x] 1.2 Identified that `mock.module()` doesn't exist in Node.js 25's test runner, causing test load failure
- [x] 1.3 Leveraged existing silent logger mode during tests (`NODE_ENV=test`) — no mocking needed
- [x] 1.4 Confirmed mock scoping is unnecessary since no module replacement is performed

## 2. Verify

- [x] 2.1 Run `npm test` and confirm no "telemetry flush failed" log output appears
- [x] 2.2 Confirm all tests still pass
- [x] 2.3 Confirm lint passes
