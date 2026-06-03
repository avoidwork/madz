## Context

The TUI uses Ink for its React-based terminal interface. `App` (in `app.js`) renders `ConversationPanel` and `InputPanel` as child components. Currently:

- `App` registers a `useInput((input, key) => { ... })` hook that handles all keyboard input
- `ConversationPanel` independently registers its own `useInput((input, key) => ...)` for scroll input
- `InputPanel` has no input handler - all input logic lives in `App`
- There is no focus indicator; users cannot tell which panel will receive keystrokes

Ink allows multiple `useInput` hooks, but the order of execution means both hooks fire on every keypress. Arrow keys intended for scrolling also trigger history navigation, and vice versa.

## Goals / Non-Goals

**Goals:**
- Single source of input handling (in `App`) with focus-based routing
- Cursor visibility as the focus indicator
- Tab cycling between input and conversation focus
- All existing key behaviors preserved (typing, Enter-to-send, history nav, scroll, page up/down)

**Non-Goals:**
- Tab-based navigation between content panels (conversation/skills/memory/settings) - this remains via commands (`:panel next`)
- Focus management for StatusBar, Banner, or OnboardingPanel
- Mouse/pointer interaction support

## Decisions

### 1. Centralized focus state in App
The `isInputFocused` state will live in `App` as a boolean (default `true`). When `true`, the input cursor is visible and input keys work. When `false`, the cursor is hidden and scroll/tab keys work.

**Rationale**: `App` already manages `inputText`, `messages`, `chatHistory` and owns the single `useInput` hook. Adding one boolean state variable keeps concerns simple.

### 2. Cursor visibility as focus indicator only
The `InputPanel` accepts a `cursorChar` prop that becomes `undefined` when focus is on the conversation panel. The `Blink` component already handles `undefined` char by showing a zero-width space. No additional labels or UI elements are needed.

**Rationale**: The cursor is the most natural focus indicator for a text input. Hiding it when input is not focused immediately signals "this panel is not active". No extra labels needed.

### 3. ConversationPanel scroll input via callback ref
`ConversationPanel` no longer registers its own `useInput`. Instead, `App` routes scroll keys directly by calling `handleScrollInput(scrollRef.current, key)`. `ConversationPanel` exposes its `scrollRef` via an `onScrollRef` callback prop.

**Rationale**: This maintains the existing scroll functionality while removing the duplicate `useInput`. It also keeps both `InputPanel` and `ConversationPanel` as pure display components.

### 4. Tab and Shift+Tab handled by App
`key.tab` cycles focus from input to conversation. `key.shift` on tab key (`key.tab && key.shift`) cycles focus back to input.

**Rationale**: Consistent with standard terminal focus cycling patterns. Simple boolean toggle avoids introducing the full `panels.js` navigation for this two-way toggle.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Removing `useInput` from `ConversationPanel` breaks scroll if `scrollRef` callback isn't wired | Ensure scroll ref is properly passed and `scrollRef.current` is accessible |
| Ink `useInput` hooks are called in registration order - if both registered, both fire | Eliminated by removing `ConversationPanel`'s `useInput` |
| Tab key might conflict with terminal default behavior | Ink's `useInput` captures tab before terminal processes it; `key.tab` is available |

## Migration Plan

No migration needed - this is an internal refactor with no API or config changes. The TUI behavior changes are purely corrective (fixing key conflicts) with an additive focus indicator.

## Open Questions

- Should the initial focus be configurable via `config.yaml`? (Out of scope for now; defaulting to focus on input matches current behavior.)
