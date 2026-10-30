# Tasks

## 1. Implement the absolute-path guard

- [x] 1.1 Add a directory-resolution helper in `src/memory/expireEphemeralMemories.js` that returns `contextDir` when `path.isAbsolute(contextDir)` is true, otherwise `join(cwdParam, contextDir)`, and verify it resolves both absolute and relative paths
- [x] 1.2 Use the resolved directory for `readdir` in `expireEphemeralMemories` and verify the scan targets the correct directory
- [x] 1.3 Thread the resolved directory into `readEphemeralFile` (pass resolved dir as `contextDir` with `cwdParam` set to `""`) and verify the read path matches the scan path
- [x] 1.4 Use the resolved directory for `unlink` in `expireEphemeralMemories` and verify expired files are deleted from the correct directory

## 2. Add regression tests

- [x] 2.1 Add a test in `tests/unit/memory_expireEphemeral.test.js` that passes an absolute `contextDir` and asserts expired files are removed and non-expired files are retained
- [x] 2.2 Verify the new tests pass under `npm run test`

## Workflow follow-up

- Run `npm run lint` and `npm run coverage` and ensure they pass.
- Verify the app starts with `npm start` (with a timeout).
- Archive the change after the project's review requirements are satisfied.
