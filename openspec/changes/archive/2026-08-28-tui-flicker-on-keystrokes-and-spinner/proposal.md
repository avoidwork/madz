# Proposal: Fix TUI Flicker on Keystrokes and Spinner

## Why

The TUI flickers on every keystroke and spinner frame update because:
1. StatusBar re-renders on every statusMessage change (including spinner updates)
2. InputPanel re-renders on every keystroke (value prop change cascading from App)
3. MessageList re-renders on every renderTick change
4. App-level handlers are recreated on every render, defeating child memoization

This causes a poor user experience with visible screen flicker during normal interaction.

## What Changes

1. **Memoize StatusBar** with `React.memo` to prevent cascade re-renders from spinner/statusMessage changes
2. **Memoize InputPanel** with `React.memo` to prevent cascade re-renders from keystroke changes
3. **Memoize MessageList** with `React.memo` to prevent full bubble recreation on renderTick changes
4. **Stabilize App handlers** with `useCallback` so child components don't re-render due to handler ref changes
5. **Isolate the spinner** — replace `ink-spinner` in StatusBar with manual `stdout.write()` using ANSI escape codes, bypassing React for spinner frame updates

## Files Changed

- `src/tui/statusBar.js` — React.memo wrapper, ANSI spinner replacement
- `src/tui/inputPanel.js` — React.memo wrapper
- `src/tui/messageList.js` — React.memo wrapper
- `src/tui/app.js` — useCallback handler stabilization

## Risks

- ANSI spinner must not interfere with Ink's rendering pipeline
- useCallback dependency arrays must be correct to avoid stale closures
- React.memo with forwardRef (MessageList) requires careful composition
