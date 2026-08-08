## Why

The `marked-terminal` package (mikaelbr) has been unmaintained since October 2024 and is incompatible with `marked` 10+. This pins `madz` to `marked@9.1.6`, preventing upgrades to `marked` 15.x which include security fixes, performance improvements, and new markdown features. The `markedTerminal()` renderer crashes at runtime with `TypeError: this.renderer.space is not a function` on marked 10+.

## What Changes

- Remove `marked-terminal` from `package.json` dependencies
- Upgrade `marked` from `9.1.6` to `15.x` (latest stable)
- Add `node-emoji` and `supports-hyperlinks` as direct dependencies (previously transitive)
- Create a custom `TerminalRenderer` class extending `marked.Renderer` in `src/tui/markdownText.js`
- Implement all renderer methods with parity to `marked-terminal`'s output:
  - Headings (h1-h6) with section prefix and configurable styling
  - Paragraphs with optional text reflow to terminal width
  - Bold, italic, strikethrough with configurable chalk styles
  - Inline code and code blocks with syntax highlighting via `cli-highlight`
  - Links with terminal hyperlinks via `ansi-escapes.link()`
  - Ordered and unordered lists with proper nested handling
  - Blockquotes with configurable styling
  - Task checkboxes rendered as `[X]` / `[ ]`
  - Tables via `cli-table3` for cell alignment and borders
  - Horizontal rules spanning terminal width
  - Images rendered as fallback text `[alt](href)`
- Implement supporting infrastructure:
  - ANSI-aware text reflow to terminal width
  - Emoji rendering via `node-emoji`
  - Hyperlink detection via `supports-hyperlinks`
  - Tab handling with configurable width
  - Hard vs soft line break distinction (`\r` vs `\n`)
  - HTML entity unescaping
  - Colon escaping in code spans (prevents emoji matching)
  - Nested list handling (prevent visual joining of parent lines)
  - Configurable chalk styles matching `marked-terminal`'s `defaultOptions`
  - Chalk level detection (fallback for color-disabled environments)
- Update `tests/unit/tui.test.js` to accommodate renderer output changes

## Capabilities

### New Capabilities
- `terminal-renderer`: Custom markdown-to-terminal renderer with full ANSI styling, text reflow, emoji support, hyperlink rendering, and configurable chalk styles — replaces `marked-terminal`

### Modified Capabilities
- None (the markdown rendering capability is being replaced, not modified)

## Impact

- **Affected code**: `src/tui/markdownText.js` (primary), `tests/unit/tui.test.js` (test assertions)
- **Dependencies**: Remove `marked-terminal`, upgrade `marked` to 15.x, add `node-emoji` and `supports-hyperlinks` as direct deps
- **No other code paths**: `marked` and `marked-terminal` are only imported in `markdownText.js`
- **Tests**: `MarkdownTextInner` tests at lines 803-836 exercise the renderer; assertions are on React element structure (type, color, children) rather than raw output strings, so they should survive with minimal changes
- **Breaking**: The rendered output format will change slightly (different ANSI sequences, different spacing). This is acceptable as the output is terminal-only and user-facing formatting is preserved.

## Non-goals

- Migrating to a different markdown parser (markdown-it, etc.)
- Adding new markdown syntax support beyond what `marked` 15.x provides
- Implementing a full WYSIWYG terminal editor
- Supporting non-ANSI terminal output (plain text fallback)
