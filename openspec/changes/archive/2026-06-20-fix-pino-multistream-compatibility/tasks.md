## 1. Implement the pino v10-compatible logger

- [ ] 1.1 Replace `pino.multistream(streams)` with the v10 array-based destination API in src/logger.js
- [ ] 1.2 Remove the deprecated TODO comment about multistream deprecation
- [ ] 1.3 Verify the streams array structure is compatible with v10 API (each element has `{ stream, level }`)

## 2. Update the system-logger spec delta

- [ ] 2.1 Verify the delta spec at specs/system-logger/spec.md correctly documents the new error routing behavior
- [ ] 2.2 Ensure all scenarios in the delta spec use the correct 4-hashtag format

## 3. Test the implementation

- [ ] 3.1 Run the full test suite (`npm run test`) and verify all tests pass
- [ ] 3.2 Run lint (`npm run lint`) and verify no lint errors
- [ ] 3.3 Verify the application starts without TypeError (`npm start` background check)

## 4. Verify logging behavior

- [ ] 4.1 Confirm info/warn/debug logs write to madz.log
- [ ] 4.2 Confirm error/fatal logs write only to madz_error.log (not madz.log)
- [ ] 4.3 Confirm silent mode works in test environment (NODE_ENV=test)
- [ ] 4.4 Confirm fallback behavior works when log directories are unwritable