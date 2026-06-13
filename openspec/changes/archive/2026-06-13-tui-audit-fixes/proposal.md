## Why

A thorough audit of the TUI components (`inputPanel.js`, `conversationPanel.js`, `markdownText.js`) against the Ink API revealed 12 issues ranging from dead code and invisible UI elements to React anti-patterns and silent prop failures. A subsequent deep audit of the spec against the Ink documentation identified additional gaps: streaming cursor handling, memo index shifts, ANSI layout impact, and scroll API verification. These issues degrade the user experience (invisible cursor, broken dim styling) and create maintainability debt (unused functions, side effects in render).

## What Changes

- Remove dead code: `renderBlink`, `getBlinkState`, `handleScrollInput`, `handleResize`, `executeScrollInput`, `executeResize`, `executeAutoScroll`
- Fix cursor visibility: ensure the input cursor has a distinct color separate from typed text
- Fix `MessageBubble` dim styling: replace `dim: true` with `dimColor: true` on tool call display lines
- Fix `MessageBubble` memo: replace `_index` with content hash for stable identity
- Move auto-scroll side effects from render phase to `useEffect`
- Fix `MarkdownText` double-wrapping: remove redundant `wrap: "hard"` since `marked-terminal` already produces wrapped output
- Add caching for `parseMarkdown` results to avoid reparsing on every render
- Strip streaming cursor character (`\u2588`) before markdown parse
- Guard scroll calls with Ink's interactive mode detection (`isTTY && !CI`) and null ref check
- Add stable `key` prop to `InputPanel`
- Document known limitations: long unbroken strings, ANSI layout impact

## Capabilities

### New Capabilities
- `tui-audit-fixes`: Fixes for TUI input panel, conversation panel, and markdown rendering

### Modified Capabilities
- *(none — this is a pure implementation fix, no spec-level behavior changes)*

## Impact

- `src/tui/inputPanel.js` — remove dead code, fix cursor color logic
- `src/tui/conversationPanel.js` — remove dead code, move side effects to useEffect, guard scroll calls
- `src/tui/markdownText.js` — remove double-wrapping, add parse result caching, strip streaming cursor
- `src/tui/messages.js` — `MessageBubble` dim prop fix, memo stable identifier
- `src/tui/app.js` — add key prop to InputPanel
