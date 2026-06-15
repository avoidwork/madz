## Context

The `InputPanel` component in `src/tui/inputPanel.js` currently renders a cosmetic block character (`█`) as a cursor via a custom `Blink` component. This approach appends the cursor character to the text output, which:
- Does not control the actual terminal cursor position
- Lacks IME (Input Method Editor) support
- Causes visual glitches with wide characters (emoji, CJK)
- Is not the idiomatic Ink pattern for cursor management

The `useCursor` hook from Ink provides `setCursorPosition({ x, y })` to position the actual terminal cursor relative to the Ink output after each render.

## Goals / Non-Goals

**Goals:**
- Replace the `Blink` component with Ink's `useCursor` hook
- Compute accurate cursor x position using `string-width` for wide character support
- Hide cursor when input is empty, show it when typing
- Remove `cursorChar` prop and `Blink` component from the public API

**Non-Goals:**
- Changes to status bar, conversation panel, or other TUI components
- Cursor color/theme customization (terminal-controlled)
- IME implementation (IME support is a byproduct of proper cursor positioning)
- Migration of `cursorChar`/`blinkTimeout` config options (breaking change, acceptable)

## Decisions

### Decision 1: Use `useCursor` hook directly in `InputPanel`
**Rationale:** The hook needs to be called within the component that renders the input text, so it can compute the cursor position from the current text length. `InputPanel` is the natural location.

**Alternatives considered:**
- Lift cursor logic to `App` component: Would require passing text length up, breaking component encapsulation.
- Custom hook wrapper: Unnecessary abstraction for a single hook call.

### Decision 2: Use `string-width` for x-position calculation
**Rationale:** The prompt (`> `) and input text may contain wide characters (emoji, CJK) that occupy 2+ terminal columns. `string-width` correctly measures display width, unlike `String.length`.

**Alternatives considered:**
- Manual byte counting: Would fail on wide characters and ANSI escape codes.
- `strip-ansi` + `length`: Would handle ANSI but not wide characters.

### Decision 3: Hide cursor when input is empty
**Rationale:** Ink's `useCursor` accepts `undefined` to hide the cursor. An empty input line should not show a blinking cursor — this matches user expectations and avoids visual noise.

**Alternatives considered:**
- Always show cursor: Could be confusing when input is empty (user might think something is wrong).

### Decision 4: Cursor y-position is `totalRows - 1`
**Rationale:** The `InputPanel` is rendered in the last row of the Ink output (below the status bar). The `useCursor` hook's `setCursorPosition` positions relative to the Ink output root, so `y = totalRows - 1` places the cursor correctly.

**How to get totalRows:** The App component knows the layout dimensions. We can either:
- Pass `totalRows` as a prop to `InputPanel` (cleaner, more explicit)
- Hardcode based on known layout (fragile)
- Use `useInput` or another hook to infer (overly complex)

**Decision:** Pass `totalRows` as a prop from `App`.

## Risks / Trade-offs

### Risk: Cursor position may be off by one row
**Mitigation:** The `useCursor` hook positions relative to the Ink output root. The `InputPanel` is the last element rendered, so `y = totalRows - 1` should be correct. Test with the actual layout.

### Risk: `string-width` adds a new dependency
**Mitigation:** It's a small, well-maintained package (single function). The benefit of correct wide character handling far outweighs the dependency cost.

### Risk: Breaking config changes
**Mitigation:** The `tui.cursorChar` and `tui.blinkTimeout` config options are removed. This is documented as a breaking change. Most users won't have customized these values.

## Migration Plan

1. Update `inputPanel.js`: Replace `Blink` with `useCursor`
2. Update `app.js`: Remove `cursorChar` prop, add `totalRows` prop
3. Update config schema: Remove `cursorChar` and `blinkTimeout`
4. Add `string-width` to `package.json`
5. Update/remove existing cursor tests
6. Add new tests for cursor positioning and wide characters

## Open Questions

- None identified. The `tui-cursor-positioning` spec already defines the requirements clearly.
