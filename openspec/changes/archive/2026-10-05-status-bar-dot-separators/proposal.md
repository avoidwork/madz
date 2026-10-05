## Why

The left side of the TUI status bar wraps every element in `[ ]` brackets, creating visual clutter that makes the left side noisy and hard to scan. Replacing the brackets with a light floating dot separator (`∙`, U+2219), spacing out unicode glyphs, and condensing context-window numbers improves readability while keeping all the same information visible.

## What Changes

- Replace the `[ ]` brackets with a light floating dot (`∙`, U+2219) separator placed to the left of each item.
- The model name is the first element after the streaming indicator and gets **no dot**. Every element after the model name (skills, messages, context, tokens, project) gets a `∙` to its left.
- Space out unicode glyphs from the following number (e.g., `⚡ 12` rather than `⚡12`).
- Apply SI postfix to context-window-centric numbers (`▦` context size, `💎` token budget) — e.g., `12.2k`, `1.4M`. Skills (`⚡`) and messages (`💬`) keep plain counts with no SI postfix.

## Capabilities

### New Capabilities
- `status-bar-dot-separators`: The status bar left side renders elements with light floating dot separators (`∙`) instead of `[ ]` brackets, with the model name getting no dot, unicode glyphs spaced from their values, and SI postfix applied to context-window and token-budget numbers.

### Modified Capabilities
- `status-bar-visibility`: The per-item visibility behavior is unchanged, but the rendering format of visible items changes from `[ ]` brackets to `∙` dot separators. The model name remains the first element and gets no dot.

## Impact

- `src/tui/statusBar.js` — the `StatusBar` component rendering logic and the `formatSize` helper (which becomes the SI postfix formatter).
- `tests/unit/tui/statusBar.test.js` — update assertions for the new dot-separator layout and SI postfix formatting.
- `tests/unit/statusBar.test.js` — update `formatSize` assertions for SI postfix behavior.

## Non-goals

- No change to the right side of the status bar (version, quote).
- No change to the streaming indicator (`∙∙∙` / spinner).
- No change to the per-item visibility configuration (`tui.statusBar` booleans).
- No new npm packages or system dependencies.
