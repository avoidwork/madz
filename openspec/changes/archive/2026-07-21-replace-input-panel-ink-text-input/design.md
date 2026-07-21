## Context

The TUI uses a custom `InputPanel` component (`src/tui/inputPanel.js`) that renders a blinking cursor over plain text. All input handling — keystroke accumulation, Enter-to-submit, backspace, history navigation, focus management — lives in App's single `useInput` hook (~75 lines at app.js:739). This creates a monolithic input handler that couples App tightly to input behavior and requires manual implementation of every keyboard feature.

Current state:
- `InputPanel` is purely presentational (renders text + Blink cursor)
- App owns all input state (`inputText`, `historyIndex`, `inputFocused`)
- App's `useInput` hook handles every keystroke case
- No cursor movement, word deletion, or multi-line support

## Goals / Non-Goals

**Goals:**
- Replace `InputPanel` with `ink-text-input` component
- Move input-focused keystroke handling into the input component
- Reduce App's `useInput` hook size and complexity
- Gain built-in cursor navigation, word deletion (Ctrl+W), line clearing (Ctrl+U), text selection
- Preserve existing features: history navigation, command parsing, streaming state awareness
- Maintain Tab key for focus toggle between input and message list

**Non-Goals:**
- Changing the onboarding input flow (remains separate)
- Modifying the message list or other TUI panels
- Adding new TUI features beyond input handling improvements
- Changing the streaming/interrupt mechanism

## Decisions

### Decision: Use `ink-text-input` over building custom component
**Rationale:** `ink-text-input` is a well-maintained Ink component that provides battle-tested input handling. Building a custom equivalent would require reimplementing cursor movement, selection, multi-line editing, and keyboard shortcuts — all of which are edge-case-heavy and well-solved by the existing package.

### Decision: Keep history navigation in App, not in input component
**Rationale:** History navigation reads from `chatHistory` which is App state. The input component would need a callback-based API to access history, which adds complexity. Simpler to keep history logic in App and wire it via `onChange`/`onSubmit` callbacks. The input component's `onSubmit` fires on Enter, and App can manage history indexing separately.

### Decision: Handle Tab key at App level for focus toggle
**Rationale:** Ink's raw mode consumes Tab at the process level. The input component's built-in focus API may not intercept Tab before Ink does. App-level handling via `useInput` is the most reliable approach for now.

### Decision: Preserve Blink cursor config via ink-text-input props
**Rationale:** `ink-text-input` supports custom cursor characters and styling. We can pass `cursorChar` and `cursorColor` from config to maintain existing behavior.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `ink-text-input` API changes between versions | Pin version in package.json, add integration tests |
| Tab key handling conflicts with Ink raw mode | Keep Tab handling in App's `useInput`, use input component's focus methods |
| History navigation UX changes | Preserve existing up/down arrow behavior via App-level handling |
| Onboarding input flow affected | Keep onboarding input separate — it uses its own `useInput` path |
| Multi-line input changes Enter behavior | Use `onSubmit` callback which fires on Enter (not Shift+Enter) |

## Migration Plan

1. Add `ink-text-input` dependency
2. Replace `InputPanel` component with `ink-text-input` wrapper
3. Update App to use input component callbacks (`onSubmit`, `onChange`, `onFocus`, `onBlur`)
4. Simplify App's `useInput` hook — remove input-focused keystroke cases, keep Tab, Escape (when not focused), and message list navigation
5. Update tests for new component structure
6. Verify all existing TUI behavior is preserved

## Open Questions

- Does `ink-text-input` support the exact cursor character configuration we need (unicode block, configurable)?
- How does `ink-text-input` handle multi-line input with Enter vs Shift+Enter?
- Can we pass the existing `cursorColor` config through to `ink-text-input`?
