## Why

The TUI input supports `@` file-path autocomplete but has no autocomplete for slash-commands (`/config`, `/provider`, `/schedule`, etc.). Users must remember every command name, which is error-prone and cramped.

## What Changes

- Add a `/`-prefix command autocomplete picker that suggests registered commands and skills as the user types, mirroring the existing `@` file-path picker.

## Capabilities

### New Capabilities
- `tui-slash-command-autocomplete`: The TUI input SHALL open a command picker on a `/` trigger token at a word boundary, filter registered commands and skills by prefix, and replace the token on selection.

### Modified Capabilities
- (none — no existing spec-level behavior changes)

## Impact

- `src/tui/commandPicker.js` (new) — `deriveCommandFilter`, `shouldOpenCommandPicker`, `CommandPicker` component.
- `src/tui/inputArea.js` — command picker gate, `commandList` prop.
- `src/tui/app.js` — thread `commandList` into `InputArea`.
- `tests/unit/tui/commandPicker.test.js` (new) — unit tests for the command filter helpers.
- `tests/unit/tui/inputArea.test.js` — tests for the picker gate.

## Non-goals

- Fuzzy command matching (prefix/substring filter only).
- Changing the existing `@` file-path autocomplete behavior.
