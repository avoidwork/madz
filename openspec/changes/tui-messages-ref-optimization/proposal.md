## Why

The TUI app's message rendering during AI streaming causes excessive re-renders due to array cloning on every streaming chunk. The `useState`-based message array requires creating a new array reference for each update, triggering React reconciliation even when the visual output hasn't meaningfully changed. This creates unnecessary CPU overhead and can cause janky streaming visuals during high-chunk-rate responses.

## What Changes

- Replace `useState([])` with `useRef([])` for mutable message storage in `src/tui/app.js`
- Introduce `forceRender` state (useState(0)) to decouple data mutation from UI updates
- Convert all 19 `setMessages` call sites to mutate `messagesRef.current` directly
- Add throttle strategy via `renderTickRef` to limit re-render frequency during streaming
- Wrap `createStreamingHandler` in `useCallback` to prevent callback reference churn
- Update tests to read from `messagesRef.current` instead of mocking `setMessages`

## Capabilities

### New Capabilities
- `tui-message-optimization`: Ref-based message storage with throttled rendering for TUI streaming

### Modified Capabilities
<!-- No spec-level requirement changes — this is a pure implementation optimization -->

## Impact

- **Affected code**: `src/tui/app.js` (primary), `tests/unit/tui.test.js` and related TUI tests
- **No changes**: `src/tui/conversationPanel.js` (already optimized with memoization), `src/tui/messages.js` (pure utilities)
- **Behavioral parity**: Identical visual output, fewer intermediate re-renders during streaming
- **Testing impact**: Test assertions need to read from `messagesRef.current` instead of mocking `setMessages`