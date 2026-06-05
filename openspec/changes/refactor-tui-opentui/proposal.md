## Why

The TUI runs on Ink (a React-to-terminal renderer) plus separate packages for scrolling (`ink-scroll-view`), markdown (`marked` + `marked-terminal`), and custom cursor blink logic. OpenTUI (`@opentui/core` + `@opentui/react`) provides these same capabilities natively through its Zig renderer core, eliminating four npm dependencies and ~160 lines of hand-rolled logic.

## What Changes

- Replace `ink` + `ink-scroll-view` with `@opentui/core` + `@opentui/react`
- JSX elements change from PascalCase (`<Box>`, `<Text>`) to lowercase (`<box>`, `<text>`) with hex foreground colors
- Replace `marked` + `marked-terminal` with OpenTUI's native `<markdown>` component
- Replace hand-rolled scroll auto-scroll/resize/remeasure logic with OpenTUI's `stickyScroll` + `stickyStart` on `ScrollBox`
- Replace hand-rolled blinking cursor display with OpenTUI's built-in `<input>` cursor, or a simple static `<text>` (display-only behavior unchanged)
- Replace Ink hooks (`useInput`, `useWindowSize`, `useStdout`) with OpenTUI React hooks (`useKeyboard`, `useTerminalDimensions`, `useOnResize`)
- Update entry point to use `createCliRenderer()` / `createRoot()` instead of Ink's `<Application>`
- Update key bindings: `key.upArrow` → `key.name === "up"`, etc.

## Capabilities

### New Capabilities

- `tui-opentui`: Runtime migration from Ink to OpenTUI (Zig-native terminal renderer with React reconciler)

### Modified Capabilities

- `tui-scroll-view`: Replaces `ink-scroll-view` with native OpenTUI `ScrollBox` + `stickyScroll`. **BREAKING** — the spec's requirement to use `ink-scroll-view` is replaced.
- `input-cursor`: Cursor display remains (visible at end of input text) but blinking animation is removed in favor of the display-only input panel pattern. **BREAKING** — the `blinkTimeout` config field is no longer applicable.
- `markdown-rendering`: Replaces `marked` + `marked-terminal` with OpenTUI's native `<markdown>` component. The rendered result is the same — requirements are preserved. **BREAKING** — implementation changes from a custom parser to a native component.
- `tui-interface`: No requirement changes — all behavioral requirements (chat mode, batch mode, keyboard nav, command entry, banner) remain identical. Only the underlying renderer changes.

## Impact

**Code:** 12 of 16 `src/tui/` files. 4 utility files (`panels.js`, `hooks.js`, `messages.js`, `commandParser.js`) unchanged.

**Dependencies:** Remove `ink`, `ink-scroll-view`, `marked`, `marked-terminal`. Add `@opentui/core`, `@opentui/react`.

**Entry point:** `index.js` — `<Application>` wrapper replaced by `createCliRenderer()` / `createRoot()`.

**Tests:** `tests/unit/tui.test.js` — rendering helpers need updating for OpenTUI React's JSX model. Pure utility tests unaffected.

**Config:** `tui.blinkTimeout` config field is no longer relevant. `tui.cursorChar` remains supported.
