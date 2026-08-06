## Why

The `marked-terminal` package (mikaelbr) has been unmaintained since October 2024. Its renderer code relies on `renderer.space()`, a method removed in `marked` 10+, making it incompatible with any `marked` version past 9.x. The project is stuck on `marked@9.1.6`, missing years of security fixes, performance improvements, and new markdown features. Replacing it with a custom renderer unlocks the upgrade path to `marked` 15.x.

## What Changes

- Remove `marked-terminal` dependency entirely from `package.json`
- Upgrade `marked` from 9.1.6 to 15.x (latest stable)
- Add `node-emoji` and `supports-hyperlinks` as direct dependencies
- Implement a custom `TerminalRenderer` class extending `marked.Renderer` with full parity to `marked-terminal`'s output
- Replace the `markedTerminal()` import in `src/tui/markdownText.js` with `new TerminalRenderer()`
- Update `markdown-rendering` spec to reflect the new rendering infrastructure (emoji, hyperlinks, reflow, tables)
- No breaking changes to the `MarkdownTextInner` React component or its tests

## Capabilities

### Modified Capabilities

- `markdown-rendering`: Add requirements for emoji rendering, hyperlink support, ANSI-aware text reflow, table rendering, and configurable styling. The existing rendering requirements remain valid — only the implementation changes.

## Impact

- **Files affected:** `src/tui/markdownText.js` (primary integration point), `package.json` (dependency changes), `tests/unit/tui.test.js` (may need minor updates)
- **Dependencies:** Remove `marked-terminal`, upgrade `marked`, add `node-emoji`, `supports-hyperlinks`
- **API:** No breaking changes. The `parseMarkdown()` function signature and return type remain identical.
- **Non-goals:** Performance optimization, additional markdown syntax support, changes to other TUI panels, changes to the OpenSpec tooling.
