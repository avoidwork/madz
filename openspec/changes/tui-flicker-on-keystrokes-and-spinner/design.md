# Design: Fix TUI Flicker on Keystrokes and Spinner

## Context

The TUI (`src/tui/`) is built on Ink (a React-based terminal UI framework). The main App component (`src/tui/app.js`) renders StatusBar, InputPanel, and MessageList as children. Every keystroke triggers a state update in App (`setInputText`), which causes a full re-render of App and all children. Similarly, every spinner frame update triggers `setStatusMessage`, causing StatusBar to re-render and cascade to App.

The project uses Ink 7.x with React 18+. The codebase already uses `useCallback` in some places (e.g., `updateContextSize`, `createStreamingHandler`) but not on the handlers passed to child components.

## Goals / Non-Goals

**Goals:**
- Eliminate unnecessary re-renders of StatusBar, InputPanel, and MessageList
- Stabilize handler references in App so memoized children don't re-render
- Replace the React-based spinner with a direct stdout ANSI escape sequence approach

**Non-Goals:**
- Debouncing or throttling input (not needed if memoization works correctly)
- Refactoring the App component structure
- Adding new dependencies
- Changing the streaming message update mechanism

## Decisions

### Decision 1: Use `React.memo` for StatusBar, InputPanel, MessageList

**Rationale:** These components receive props that change frequently (value, statusMessage, renderTick). `React.memo` performs shallow comparison and skips re-render when props are unchanged. This is the simplest and most effective approach for the TUI's render tree.

**Alternatives considered:**
- `useMemo` for computed values — doesn't prevent re-render of the component itself
- Custom `shouldComponentUpdate` — unnecessary in functional components with React.memo
- State hoisting — would complicate the component hierarchy unnecessarily

### Decision 2: Use `useCallback` for App handlers

**Rationale:** App passes `onChange`, `onSubmit`, `onFocus`, `onBlur` to InputPanel. Without `useCallback`, these are recreated on every App render, causing InputPanel (even with `React.memo`) to re-render because the function reference changes.

**Alternatives considered:**
- Inline handlers — defeats memoization entirely
- `useRef` for handlers — unnecessary complexity; `useCallback` is the standard pattern

### Decision 3: Replace ink-spinner with ANSI escape codes

**Rationale:** The `ink-spinner` component updates on every frame, triggering a full React render cycle. By using `stdout.write()` with ANSI escape codes (`\r` to return to line start, `\x1B[?25l` to hide cursor), we can update the spinner character directly on the terminal without going through React's reconciliation.

**Alternatives considered:**
- `React.memo` on StatusBar alone — still re-renders the entire StatusBar including the static parts
- Debounce spinner updates — reduces flicker but doesn't eliminate it; ANSI approach is cleaner

**Implementation:**
- Use a `useEffect` with `setInterval` to write spinner frames directly to stdout
- Use `\r` carriage return to overwrite the spinner position each frame
- Use `\x1B[?25l` to hide cursor during animation, restore with `\x1B[?25h` on unmount
- Spinner frames: `⠋`, `⠙`, `⠹`, `⠸`, `⠼`, `⠴`, `⠦`, `⠧`, `⠇`, `⠏` (10 frames, 80ms interval)

### Decision 4: Wrap MessageList with React.memo

**Rationale:** MessageList uses `forwardRef` and manages its own internal state (scrollOffset, renderTick). `React.memo` with `forwardRef` prevents unnecessary re-renders when the parent passes the same `messages` and `renderWindow` props.

**Note:** MessageList's internal `renderTick` state is used for imperative add/remove operations. `React.memo` will skip re-render when props are shallowly equal, but the internal state updates will still trigger re-renders — which is the desired behavior.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| ANSI spinner interferes with Ink rendering | Use `\r` to stay on the same line; Ink renders StatusBar below the spinner line |
| `useCallback` stale closures | Carefully construct dependency arrays; use refs for mutable values accessed in handlers |
| `React.memo` shallow comparison misses nested prop changes | Props are primitives or stable refs; no nested objects passed to memoized components |
| Spinner interval not cleaned up on unmount | Include cleanup function in `useEffect` that clears interval and restores cursor |

## Migration Plan

1. Modify `src/tui/statusBar.js` — add `React.memo`, replace spinner with ANSI approach
2. Modify `src/tui/inputPanel.js` — add `React.memo`
3. Modify `src/tui/messageList.js` — add `React.memo` wrapper
4. Modify `src/tui/app.js` — wrap handlers with `useCallback`
5. Run tests to verify no regressions

## Open Questions

- None. The approach is straightforward and well-understood.
