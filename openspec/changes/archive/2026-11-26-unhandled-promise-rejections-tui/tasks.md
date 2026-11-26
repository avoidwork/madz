# Tasks

## 1. System panel rejection handling

- [ ] 1.1 Add a `.catch()` to the `gatherSystemInfo().then(...)` chain in `src/tui/systemPanel.js` that handles the rejection, respects the `cancelled` flag so it does not set state after unmount, and surfaces the failure (e.g., set an error state or log). Verify by running `npm run lint` and `npm run test` and confirming no unhandled-rejection warnings in the system panel path.

## 2. Copilot auth dynamic import rejection handling

- [ ] 2.1 Add a `.catch()` rejection handler to the dynamic `import("../provider/copilotAuth.js").then(...)` chain at `src/tui/app.js` line 311 so a module-load failure is handled gracefully and respects the `disposed` flag. Verify by running `npm run lint` and `npm run test`.
- [ ] 2.2 Add a `.catch()` rejection handler to the dynamic `import("../provider/copilotAuth.js").then(...)` chain at `src/tui/app.js` line 332 (effect cleanup) so a module-load failure is handled gracefully and respects the `disposed` flag. Verify by running `npm run lint` and `npm run test`.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
