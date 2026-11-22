# Tasks

## 1. SystemPanel Component

- [ ] 1.1 Create `src/tui/systemPanel.js` exporting a `SystemPanel` component that gathers system info via Node built-ins (`node:os`, `node:fs`, `node:process`) and renders it read-only, with an escape back to conversation via `onViewChange("conversation")`. Verify by running the new `tests/unit/tui/systemPanel.test.js`.
- [ ] 1.2 Add `tests/unit/tui/systemPanel.test.js` covering the info-gathering function (CPU count, memory, uptime, platform) and edge cases (missing `fs.statfs`, unavailable load average). Verify `npm run test` passes.

## 2. Panel Registration

- [ ] 2.1 Add `SYSTEM: "system"` to `PANELS` and append `PANELS.SYSTEM` to `getPanelOrder()` in `src/tui/panels.js`. Verify by updating `tests/unit/tui/panels.test.js` (order length 8, last panel) and running `npm run test`.
- [ ] 2.2 Add a `currentView === PANELS.SYSTEM` branch in `src/tui/app.js` rendering `SystemPanel` with `onViewChange` and `activeView`. Verify by running `npm run lint` and `npm run test`.

## 3. Command Registration

- [ ] 3.1 Add `["system", "system"]` to the view-switching loop in `src/tui/commandParser.js`. Verify by adding `/system` to the `isViewCommand` test in `tests/unit/tui/commandParser.test.js` and running `npm run test`.
- [ ] 3.2 Add `/system - view system info panel` to the "Command:" section of `COMMAND_GROUPS` in `src/tui/commandHelp.js`. Verify by running `npm run lint`.

## 4. Verification

- [ ] 4.1 Run `npm run test`, `npm run lint`, and `npm run coverage` and confirm all pass.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
