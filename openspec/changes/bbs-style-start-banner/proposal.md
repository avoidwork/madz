## Why

Users launching the TUI have no visible reference for available commands and capabilities. A startup banner with ASCII art and a command help menu would provide an engaging onboarding experience, similar to classic BBS systems, while also surfacing built-in commands and navigation hints at a glance.

## What Changes

- Add a startup banner component that renders once with ASCII art and a built-in commands help menu when the TUI enters interactive mode.
- The banner displays after app initialization and auto-dismisses or is dismissable so the normal chat UI takes over.
- Banner includes the project logo ASCII art and a grouped list of available commands (e.g., `:provider`, `:memory`, `:schedule`, `:quit`, `:help`).

## Capabilities

### New Capabilities
- `tui-banner`: Display a BBS-style startup banner with ASCII art and a built-in command help menu when the TUI enters interactive mode.

### Modified Capabilities
- `tui-interface`: Adds a new requirement for a startup banner that appears on TUI launch and is dismissable.

## Impact

- `index.js`: May need to trigger the banner on interactive mode entry.
- `src/tui/app.js`: Integrate the banner as a first-phase view.
- `src/tui/components.js`: Add Banner component export.
- `openspec/specs/tui-interface/spec.md`: Add delta spec for banner requirement.
- `openspec/specs/tui-banner/spec.md`: New spec file.
- `tests/unit/tui.test.js`: New unit tests for banner component.
