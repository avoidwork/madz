# Proposal

## Why

While the conversation panel has focus, `useMouseScroll` enables terminal mouse reporting, so the terminal no longer handles link clicks natively. Markdown links are effectively not clickable there. Disabling reporting would regress wheel scroll and drag-to-copy, so the app must handle link clicks itself. Closes #1685.

## What Changes

- `useMouseScroll` gains an `onClick({x, y})` callback fired on a left-button release at the press cell with no drag in between. The drag/selection path is unchanged.
- `markdownText.js` records link spans `{text, href}` in both the OSC 8 and the `text (url)` branches; the parse cache stores `{text, links}` (new `parseMarkdownWithLinks`; `parseMarkdown` is unchanged for callers).
- New `src/tui/linkHit.js` maps a click to a link using the bubble rect (`getBoundingClientRect`), the scroll offset and viewport (`ScrollContext.getScrollInfo`), and the wrapped rendered text. `messageBubble.js` registers each markdown block as a target.
- New `src/tui/openUrl.js` validates with `new URL()`, allows only http/https/mailto, spawns the platform opener with an args array, and logs failures.
- `app.js` passes a click handler, gated on conversation focus (`!inputFocused`), conversation view and closed file picker.

## Capabilities

### New Capabilities

- `tui-link-click`: mouse clicks on markdown links in the focused conversation panel.

## Impact

`src/tui/useMouseScroll.js`, `markdownText.js`, `messageBubble.js`, `app.js`, new `linkHit.js`, `openUrl.js`; tests in `tests/unit/tui/`. No new dependencies.
Overlap: unmerged PR #1686 edits the same region of `app.js`.

## Non-goals

No change to wheel scroll, drag selection or clipboard copy; no status-bar message.
