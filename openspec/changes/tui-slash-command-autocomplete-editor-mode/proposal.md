## Why

The TUI input supports `@` file-path autocomplete but has no autocomplete for slash-commands (`/config`, `/provider`, `/schedule`, etc.) and no way to compose a long input in an external editor. Users must remember every command name and edit multi-line prompts inline, which is error-prone and cramped.

## What Changes

- Add a `/`-prefix command autocomplete picker that suggests registered commands and skills as the user types, mirroring the existing `@` file-path picker.
- Add a multi-line editor mode (Ctrl+E) that spawns `$EDITOR` to compose/edit the input before submitting.

## Capabilities

### New Capabilities
- `tui-slash-command-autocomplete`: The TUI input SHALL open a command picker on a `/` trigger token at a word boundary, filter registered commands and skills by prefix, and replace the token on selection.
- `tui-editor-mode`: The TUI input SHALL support a Ctrl+E toggle that spawns `$EDITOR` to edit the current input, submitting the edited content on save.

### Modified Capabilities
- (none — no existing spec-level behavior changes)

## Impact

- `src/tui/commandPicker.js` (new) — `deriveCommandFilter`, `shouldOpenCommandPicker`, `CommandPicker` component.
- `src/tui/inputArea.js` — command picker gate, `commandList` prop, Ctrl+E editor mode.
- `src/tui/app.js` — thread `commandList` into `InputArea`.
- `tests/unit/tui/commandPicker.test.js` (new) — unit tests for the command filter helpers.
- `tests/unit/tui/inputArea.test.js` — tests for the picker gate and editor-mode logic.

## Non-goals

- Fuzzy command matching (prefix/substring filter only).
- A separate editor panel or persistent editor buffer.
- Changing the existing `@` file-path autocomplete behavior.
