## Why

The application version is currently only shown in the startup banner. Once the banner is dismissed, there is no way to see which version of madz is running without quitting and restarting. Surfacing it in the status bar makes the running version visible at all times — useful for support, debugging, and confirming the deployed build.

## What Changes

- Add a `version` prop to the `StatusBar` component (`src/tui/statusBar.js`) and render it right-aligned in a sibling `Box` with `marginLeft: "auto"`, only when the version is truthy.
- Thread the existing `appInfo` (which already carries `version` from `package.json`) from `App` → `InputArea` → `StatusBar`:
  - `src/tui/inputArea.js` — accept `appInfo` and pass `appInfo?.version` to `<StatusBar>`.
  - `src/tui/app.js` — pass `appInfo` into `<InputArea>`.
- Update the `app-identity` spec: the version is no longer "not displayed persistently" — it now appears right-aligned in the status bar.
- Add a unit test in `tests/unit/tui.test.js` asserting the version renders when a `version` prop is provided.

No new dependencies. The version plumbing already exists from `index.js` (`appInfo = { name, version: pkg.version }`).

## Capabilities

### New Capabilities
<!-- None — this change modifies an existing capability, not a new one. -->

### Modified Capabilities
- `app-identity`: The requirement "App Identity Display" currently states the version is not displayed persistently anywhere else in the TUI. This change updates that requirement so the version IS displayed persistently, right-aligned in the bottom status bar, while remaining absent when no version is provided.

## Impact

- **Code:** `src/tui/statusBar.js`, `src/tui/inputArea.js`, `src/tui/app.js`
- **Tests:** `tests/unit/tui.test.js`
- **Specs:** `openspec/specs/app-identity/spec.md` (delta)
- **Dependencies:** None — no new npm packages. `index.js` already constructs `appInfo` and passes it to `App`.
- **Systems:** TUI status bar rendering only. No API, config, or data-layer changes.

## Non-goals

- Not adding a `/version` slash command.
- Not changing the startup banner behavior.
- Not adding any new dependencies or configuration.
- Not modifying `index.js` (the `appInfo` construction already exists).
