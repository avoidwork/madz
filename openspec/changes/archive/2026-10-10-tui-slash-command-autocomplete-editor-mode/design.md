## Context

The TUI input (`src/tui/inputArea.js`) currently supports `@` file-path autocomplete via `src/tui/filePicker.js`. That module exposes `deriveFilter(value, cursor)`, `shouldOpenPicker(value)`, `replaceToken(value, tokenStart, tokenEnd, path)`, and a `FilePicker` React component. The `CommandParser` (`src/tui/commandParser.js`) exposes `listCommands()` returning registered command names, and `parse()` routes skill invocations via `context._skillList`. The `CommandParser` is instantiated in both `app.js` and `conversationArea.js`.

There is no autocomplete for `/`-prefixed commands and no way to edit a long input in an external editor.

## Goals / Non-Goals

**Goals:**
- Add a `/`-prefix command picker that suggests registered commands and skills, mirroring the `@` file picker's word-boundary and token-replacement semantics.
- Add a Ctrl+E editor mode that spawns `$EDITOR` to compose/edit the input, submitting on save.
- Keep the two pickers mutually exclusive so only one input handler owns keystrokes at a time.

**Non-Goals:**
- Fuzzy command matching (prefix/substring filter only).
- A persistent editor buffer or separate editor panel.
- Changing the existing `@` file-path autocomplete behavior.

## Decisions

### Decision 1: Mirror the file picker pattern for the command picker
Create `src/tui/commandPicker.js` exporting `deriveCommandFilter(value, cursor)`, `shouldOpenCommandPicker(value)`, and a `CommandPicker` component. The trigger token is `/` instead of `@`, with identical word-boundary rules: the `/` must be at the start of input or preceded by a space, and must be followed by a non-whitespace character. This keeps the two pickers consistent and testable.

**Alternatives considered:**
- A fuzzy matcher (e.g., fzf-style scoring) — rejected as overkill for the small command set.
- Reusing `deriveFilter` with a parameterized trigger char — rejected because the token semantics differ (commands are a fixed list, not a globbed filesystem).

### Decision 2: Mutually exclusive pickers
In `InputArea`, add a `commandPickerOpen` state gated by `shouldOpenCommandPicker(inputText)`. When the command picker is open, the file picker is not rendered and vice versa. This avoids two overlapping `useInput` handlers fighting over keystrokes.

### Decision 3: Thread the command list from App
`app.js` already instantiates `parser = new CommandParser()`. Pass `commandList={parser.listCommands()}` to `InputArea`. The skill list is available via the skills registry; thread the skill names into the command list so skills appear as suggestions. `InputArea` receives a new `commandList` prop (an array of strings).

### Decision 4: Editor mode uses async `child_process.spawn`
On Ctrl+E, write `inputText` to a temp file in `os.tmpdir()`, spawn `$EDITOR` (falling back to `vi`) with `stdio: "inherit"`, and on exit (code 0) read the file back, clean up, and call `handleSubmit`. On non-zero exit, clean up and show a status message without submitting. Use async `spawn`, not `spawnSync`, to avoid blocking the TUI event loop.

## Risks / Trade-offs

- **Two pickers could both try to open** → Gate them mutually exclusively; only one `pickerOpen`/`commandPickerOpen` is true at a time.
- **`$EDITOR` unset** → Fall back to `vi`; if spawn fails, show a status message.
- **Editor spawn blocks the TUI** → Use async `spawn` with a callback, never `spawnSync`.
- **Temp file leak** → Always clean up in the editor-exit callback, including on non-zero exit.
- **Command list could be empty** → The picker renders "No matching commands." and does not crash.
