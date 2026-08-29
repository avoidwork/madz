## Why

The TUI performs unnecessary re-renders on every state change, particularly on every keystroke in the input field. This causes visible sluggishness during typing and wastes CPU cycles. The three optimizations below isolate state changes and prevent unnecessary work with minimal risk.

## What Changes

- Wrap `ConversationPanel` in `React.memo` to prevent re-renders when props are stable
- Add a custom `areEqual` comparator to `App` that ignores frequently-changing props (inputText, statusMessage, chatHistory, historyIndex, inputFocused, showBanner, onboardingResponse) while comparing stable props
- Remove the fragile module-level cache (`lastContentRef`/`lastElementRef`) from `MarkdownText` — the `React.memo(MarkdownTextInner)` wrapper plus the LRU cache in `parseMarkdown` already handle deduplication

## Capabilities

### New Capabilities
- `tui-performance`: Performance optimizations for the TUI render pipeline — memoization of ConversationPanel and App, removal of redundant module-level cache in MarkdownText

### Modified Capabilities
<!-- No existing spec-level requirements are changing — only implementation details -->

## Impact

- `src/tui/conversationPanel.js` — ConversationPanel memoization
- `src/tui/app.js` — App memoization with custom comparator
- `src/tui/markdownText.js` — Module-level cache removal
- `tests/unit/tui.test.js` — May need updates for memoization behavior changes
