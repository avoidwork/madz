## Context

The TUI input panel (`src/tui/inputPanel.js`) currently renders only the typed text with an IRC-style prompt (`> ` or `: `). There is no visual cursor indicator. During streaming, a block cursor `█` is appended to assistant messages in the conversation panel (app.js:147), but the input panel has no equivalent indicator. Users type into a void — text appears but there is no cursor position cue at the end of the input string.

The existing component architecture:
- `src/tui/app.js` — handles state (`inputText` via `useState`), keyboard input (`useInput`), and renders `InputPanel`
- `src/tui/inputPanel.js` — display-only component, receives `inputText` prop
- `src/config/schemas.js` — Zod schemas for config validation
- `config.yaml` — source of project configuration

## Goals / Non-Goals

**Goals:**
- Render a blinking cursor at the end of input text in the chat panel
- Make cursor character configurable via `config.yaml` under `tui.cursorChar`
- Make blink interval configurable via `config.yaml` under `tui.blinkTimeout`
- Use Ink's `useInterval` for proper React lifecycle management

**Non-Goals:**
- Text selection highlighting (Ink's `Selection`)
- Text editing/positioning within the input text
- Custom cursor shapes (e.g., line, block, underline toggle)
- Cursor animation effects beyond simple on/off visibility toggle

## Decisions

### 1. Use Ink's `useInterval` over `useState` + `setInterval`
`useInterval` from Ink is designed for React components. It persists across renders (unlike `useEffect` with `setInterval` which resets the timer on every re-render of the parent component). This is critical because `InputPanel` re-renders whenever the user types a character — a raw `setInterval` in `useEffect` would reset the blink on every keystroke.

### 2. Blink sub-component in `inputPanel.js` instead of app level
The Blink logic belongs in the rendering layer. `InputPanel` owns the cursor display — it doesn't own input state. This keeps the separation: `app.js` manages state, `InputPanel` manages display. The `Blink` component manages its own internal `visible` state via `useState`.

### 3. Cursor character as config string, not a special escape
`cursorChar` is a plain string defaulting to `█` (U+2588 FULL BLOCK). Users can set it to `_`, `▌`, or any single character. Keeping it as a simple config value avoids escaping logic and keeps the schema straightforward.

### 4. No Selection component — just a blinking Text
Ink's `Selection` component highlights text in a specific region. A blinking cursor is fundamentally different — it's a transient character that toggles visibility, not a selection overlay. A minimal `Box`+`Text` approach is cheaper and produces the expected visual result.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Wide unicode chars (e.g., `█`) may cause terminal cursor positioning quirks | `Text` from Ink handles unicode rendering; wide chars are safe in terminal output |
| `useInterval` may not exist in all Ink versions | Ink 3.x+ includes `useInterval`; verify `package.json` has it |
| 100% coverage requires testing a React component with hooks | Write tests that verify the Blink component returns the correct React element structure with visible/invisible cursor |
| Config change affects runtime without restart (hot reload) | `setConfigValue` persists to `config.yaml`; App re-receives config via props on re-render from command execution, but for full reload the user must restart — acceptable since it's a one-time config change |
