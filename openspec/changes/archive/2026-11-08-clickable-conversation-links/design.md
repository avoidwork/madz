# Design

## Context

Raw message text contains `[text](url)` while the display does not, so `selectionLayout.js` cannot be used for hit-testing. Rendered text is the source of truth.

## Decisions

1. **Click detection in `useMouseScroll`**: track whether any move left the press cell; a release at the press cell with no movement fires `onClick` in addition to the unchanged `onSelect`.
2. **Link spans** are collected in a module-level array during the synchronous `marked.parse` (saved/restored for re-entrancy) and stored with the rendered text in the existing LRU cache.
3. **Hit-testing** (`linkHit.js`): shift the block rect by the scroll offset, clip to the viewport, wrap the ANSI-stripped rendered text at the rect width (space-break, hard-cut long words), map the cell to a string index, and match against located link ranges.
4. **Registration**: each markdown block Box in `MessageBubble` registers itself in a module registry via its ref; `findLinkAt` iterates it. This avoids a second ink-mouse handler per bubble.
5. **Opener**: `new URL()` + protocol allowlist, `spawn(cmd, [args])` with `detached` and `stdio: ignore`; Windows uses `rundll32 url.dll,FileProtocolHandler` instead of `start`, which needs a shell.
6. **Gating** in `app.js` uses `!inputFocused`, `currentView === PANELS.CONVERSATION` and a closed picker (`mouseActive` exists only in unmerged PR #1686).

## Risks

- Layout assumes Ink wraps like `wrapRendered`; wide glyphs, nested styled blocks and streaming re-renders need manual terminal verification.
- Duplicate link text is matched in document order.
