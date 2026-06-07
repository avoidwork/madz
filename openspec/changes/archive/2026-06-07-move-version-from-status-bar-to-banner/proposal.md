## Why

The application name and version are currently displayed in the bottom status bar alongside status and message counts. This is redundant because the version is a startup-time detail that does not need to persist on screen during active use. The banner already renders on startup with ASCII art, making it a natural home for the version string. Users see the version once at launch and never need to see it again during their session.

## What Changes

- Remove the `appInfo.name + version` display from `StatusBar` in `src/tui/statusBar.js`
- Remove the `appInfo` prop from `StatusBar` since it will no longer be consumed
- Update status bar layout to only show the left side (status indicator, status message, skill/message counts) with no right-aligned content
- Add version display below the ASCII art in `src/tui/banner.js`
- Remove `appInfo` prop from rendering when banner is dismissed (status bar no longer needs it, so `app.js` should stop passing it)
- Update related tests to reflect the new behavior
- The `appInfo` object itself is still built in `index.js` but is no longer passed to the TUI

## Capabilities

### New Capabilities
<!-- None needed for this change -->

### Modified Capabilities
- `app-identity`: The requirement changes from displaying app name and version in the input panel (which was an incorrect spec) to displaying the version once in the startup banner under the ASCII art. The version is no longer a persistent label anywhere in the TUI.
- `tui-interface`: The startup banner scenario is updated to include the version string below the ASCII art.

## Impact

- **Affected code**:
  - `src/tui/statusBar.js` -- remove `appInfo` prop and conditional rendering
  - `src/tui/banner.js` -- add version display below ASCII art
  - `src/tui/app.js` -- remove `appInfo` prop pass-through for StatusBar
  - `tests/unit/tui.test.js` -- update identity rendering tests and any status bar tests
- **Dependencies**: No new dependencies. Existing `appInfo` flow from `index.js` can be trimmed but removing it is safer than partially keeping it.
- **Breaking**: Minor visual change -- the status bar shrinks by one element on the right side.
