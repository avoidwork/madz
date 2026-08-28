# Spec: TUI Rendering Performance

## Requirements

### R1: StatusBar Memoization
The StatusBar component MUST be wrapped with `React.memo` to prevent re-renders when its props (statusMessage, skillCount, messageCount, contextSize, isCompacting) have not changed.

### R2: InputPanel Memoization
The InputPanel component MUST be wrapped with `React.memo` to prevent re-renders when its props (value, onChange, onSubmit, onFocus, onBlur, focus) have not changed.

### R3: MessageList Memoization
The MessageList component MUST be wrapped with `React.memo` to prevent re-renders when its props (messages, assistantName, renderWindow) have not changed.

### R4: App Handler Stabilization
The App component MUST use `useCallback` for all handler functions passed to child components (onChange, onSubmit, onFocus, onBlur) to ensure stable function references across renders.

### R5: Spinner Isolation
The StatusBar component MUST NOT use `ink-spinner` for spinner animation. Instead, it MUST use direct `stdout.write()` calls with ANSI escape codes to update the spinner frame without triggering React re-renders.

### R6: Spinner ANSI Implementation
The spinner MUST use `\r` carriage return to overwrite the spinner position each frame, and `\x1B[?25l` / `\x1B[?25h` to hide/show the cursor during animation.

## Acceptance Criteria

1. Typing in the input panel does NOT cause StatusBar or MessageList to re-render
2. Spinner frame updates do NOT cause App to re-render
3. All handler references in App are stable across renders (verified via `useCallback` dependency arrays)
4. The spinner still animates correctly at the bottom of the TUI
5. No new dependencies are introduced
