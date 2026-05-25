## Why

The TUI has no visible branding or version info during interaction. Users cannot tell which version of the app they are running, making debugging, support, and general awareness of their environment impossible from the terminal UI alone.

## What Changes

- Display the application name (from `config.tui.name`, default `"madz"`) and version (from `package.json`) in the lower-left corner of the TUI, on the input panel row where the user types.
- The displayed format will be: `madz v1.0.0 > user input` — the app name and version appear to the left of the IRC-style prompt character.
- Pass the app version from `index.js` (read from `package.json`) through the `App` component down to `InputPanel`.
- No changes to `StatusBar` — the version stays in the input panel row so it is always visible at the bottom of the screen.

## Capabilities

### New Capabilities
- `app-identity`: Display application name and version in the TUI input panel

### Modified Capabilities
- `tui-interface`: Add requirement for app identity display in the input panel area

## Impact

- `index.js` — read `package.json` for version and pass it to `App`
- `src/tui/app.js` — accept and forward `appInfo` prop
- `src/tui/inputPanel.js` — render app name and version on the left
- `tests/unit/tui.test.js` — add tests for new input panel rendering
- `openspec/specs/tui-interface/spec.md` — add app identity requirement
- `openspec/specs/input-panel/spec.md` — new spec for app identity
