## 1. Reasoning Collapse/Expand

- [x] 1.1 Add a `collapsed` state object to `MessageBubbleInner` in `src/tui/messageBubble.js` keyed by segment type (`reasoning`, `toolCall`), defaulting to expanded for reasoning.
- [x] 1.2 Render a single `💭 Thinking…` line when a reasoning segment is collapsed, and the full gray content when expanded.
- [x] 1.3 Add a click/keyboard toggle handler for the reasoning collapse state.

## 2. Collapsible Tool-Call Blocks

- [x] 2.1 Wrap `toolCallEl`/`toolDisplayEl` in a collapsible block in `src/tui/messageBubble.js`.
- [x] 2.2 Show tool name + args collapsed, expandable to the full result, sourcing data from `events`/`toolCallDisplay`/`completedToolCalls`.
- [x] 2.3 Add a click/keyboard toggle handler for the tool-call collapse state.

## 3. Code-Block Copy Affordance

- [x] 3.1 Add a `[copy]` affordance on fenced code blocks in `src/tui/messageBubble.js`, reusing `clipboardy` from `src/tui/app.js`.
- [x] 3.2 Wire the copy handler to write the code block content to the clipboard, degrading gracefully on failure.

## 4. Inline Diff View

- [x] 4.1 Add a `renderDiff(text)` helper that renders file edits as green/red diff lines.
- [x] 4.2 Render the diff in a collapsible block in `src/tui/messageBubble.js`, defaulting to collapsed.

## 5. Tests

- [x] 5.1 Add unit tests for reasoning collapse/expand toggles.
- [x] 5.2 Add unit tests for tool-call collapse/expand toggles.
- [x] 5.3 Add unit tests for the code-block copy handler.
- [x] 5.4 Add unit tests for diff rendering.

## 6. Verification

- [x] 6.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm no regressions.
