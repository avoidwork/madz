## Why

The TUI streaming experience is broken in two ways: auto-scroll during streaming does not work, and the rendering pipeline generates excessive GC pressure from per-render allocations, unstable closures, and duplicated token calculation logic. Users watching streamed responses see content that does not scroll into view, and the terminal UI suffers from unnecessary re-renders and race conditions in token counting.

## What Changes

- Expose `scrollToBottom()` on MessageList's imperative API
- Create a ScrollContext to pass scroll imperative from MessageList to MessageBubble
- Call `scrollToBottom()` directly from MessageBubble when streaming content grows
- Guard the renderData/prune loop with a length-change check to eliminate per-render allocations
- Stabilize `createStreamingHandler` with `useCallback` to prevent closure churn
- Deduplicate token calculation into a single function with ordering guarantees
- Remove `React.memo` from StatusBar (props change every render, memo is useless)
- Implement manual scroll-up detection to suppress auto-scroll when user is reading history

## Capabilities

### New Capabilities
- `tui-autoscroll`: MessageBubble calls `scrollToBottom()` via context when streaming content grows, ensuring the ScrollView stays anchored to the bottom during live responses

### Modified Capabilities
- `tui-streaming`: Streaming handler stabilized with `useCallback`; renderData/prune loop guarded by length check; StatusBar React.memo removed
- `tui-scroll-view`: Manual scroll-up detection implemented to suppress auto-scroll during user reading

## Impact

- `src/tui/messageList.js` — expose `scrollToBottom()`, add ScrollContext, guard renderData loop
- `src/tui/messageBubble.js` — consume ScrollContext, call `scrollToBottom()` on content growth
- `src/tui/statusBar.js` — remove `React.memo` wrapper
- `src/tui/app.js` — deduplicate token calculation, stabilize streaming handler with `useCallback`
- No API changes, no dependency changes

## Non-goals

- Changes to Ink library or core TUI framework
- Changes to the streaming protocol or event capture logic
- Adding new keyboard shortcuts or navigation features
- Changes to the token counting algorithm itself
