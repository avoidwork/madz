## Why

The current `InputPanel` component is purely presentational — all input handling lives in App's monolithic `useInput` hook (~75 lines). This requires manual implementation of every keyboard feature and creates tight coupling between App and input behavior. Replacing it with `ink-text-input` provides built-in cursor navigation, word deletion, line clearing, multi-line support, and reduces App complexity.

## What Changes

- Replace `src/tui/inputPanel.js` presentational component with `ink-text-input` wrapper
- Add `ink-text-input` as a project dependency
- Move input-focused keystroke handling from App's `useInput` hook into the input component
- Wire input component callbacks (`onSubmit`, `onChange`, `onFocus`, `onBlur`) back to App
- Preserve existing features: history navigation, command parsing, streaming state awareness
- Remove `Blink` cursor component (handled natively by ink-text-input)
- Update `input-cursor` spec to reflect that cursor rendering is now delegated to ink-text-input

## Capabilities

### Modified Capabilities
- `input-cursor`: Cursor rendering and blinking now handled by ink-text-input instead of custom Blink component. Configurable cursor character and blink interval may still be supported via ink-text-input props.
- `tui-interface`: Keyboard navigation for the input panel changes — ink-text-input handles its own keystrokes (cursor movement, selection, Ctrl+W, Ctrl+U). Tab key for focus toggle may still need App-level handling due to Ink's raw mode.

## Impact

- `src/tui/inputPanel.js` — replaced entirely
- `src/tui/app.js` — simplified input handling, removes input state management
- `package.json` — add `ink-text-input` dependency
- `openspec/specs/input-cursor/spec.md` — delta spec for cursor handling changes
- `openspec/specs/tui-interface/spec.md` — delta spec for keyboard navigation changes
- Tests — update TUI tests for new input component
