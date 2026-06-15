## 1. Mock logger.error in shutdown.test.js

- [ ] 1.1 Read `tests/unit/shutdown.test.js` and `src/session/shutdown.js` to understand the current test structure
- [ ] 1.2 In the "suppresses telemetry flush errors" test, add a `mock.module()` call to mock `logger.error` before importing `handleShutdown`
- [ ] 1.3 Use `mock.fn()` to create a no-op error function
- [ ] 1.4 Ensure the mock is scoped to the test and doesn't leak to other tests

## 2. Verify

- [ ] 2.1 Run `npm test` and confirm no "telemetry flush failed" log output appears
- [ ] 2.2 Confirm all tests still pass
- [ ] 2.3 Confirm lint passes
