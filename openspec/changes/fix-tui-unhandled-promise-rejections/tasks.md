# Tasks

## 1. SystemPanel rejection handling

- [ ] 1.1 Add a `.catch()` rejection handler to the `gatherSystemInfo().then(...)` chain in `src/tui/systemPanel.js`, preserving the `cancelled` guard in the success handler and not calling `setInfo` on rejection. Verify by running the system panel tests and confirming no unhandled rejection path exists.

## 2. App 401 re-auth handler rejection handling

- [ ] 2.1 Add a `.catch()` rejection handler to the dynamic `import("../provider/copilotAuth.js").then(...)` chain in the 401 re-auth handler effect in `src/tui/app.js`, preserving the `disposed` guard. Verify by running the app tests and confirming no unhandled rejection path exists.
- [ ] 2.2 Add a `.catch()` rejection handler to the dynamic `import("../provider/copilotAuth.js").then(...)` chain in the same effect's cleanup function in `src/tui/app.js`, preserving the generation-counter guard. Verify by running the app tests and confirming no unhandled rejection path exists.

## 3. Verification

- [ ] 3.1 Run `npm run test` and verify all tests pass.
- [ ] 3.2 Run `npm run lint` and verify lint passes.
- [ ] 3.3 Run `npm run coverage` and verify coverage is maintained.
- [ ] 3.4 Run `npm start` and verify the application starts without crashing.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
