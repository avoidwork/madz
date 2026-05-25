## Context

The TUI (`src/tui/`) currently renders LLM message content as plain `Text` components inside the `ConversationPanel`. Messages from the assistant may contain markdown syntax (e.g., `**bold**`, `` `code` ``, `- list items`, `# headers`) but these are rendered literally rather than formatted.

The project uses Ink for terminal UI rendering. A sibling project `ink-markdown` provides markdown-to-React-element rendering compatible with Ink's component model.

## Goals / Non-Goals

**Goals:**
- Render LLM assistant messages with proper markdown formatting in the conversation panel
- Support bold, italic, inline code, code blocks, unordered lists, and headers
- Maintain existing scroll height calculation behavior for markdown-rendered content
- Keep plain-text (user) messages unchanged

**Non-Goals:**
- Markdown rendering in other panels (memory, skills, settings)
- Rich text editing or input markdown conversion
- Custom CSS or theming beyond existing Ink color/bold/dim capabilities
- Server-side markdown-to-HTML conversion

## Decisions

**D1: Use `ink-markdown` package over custom renderer**
- Rationale: `ink-markdown` is a maintained Ink-compatible package that converts markdown AST to Ink `Text`/`Box` elements. It handles GFM subsets (bold, italic, code, lists, headers) out of the box.
- Alternatives considered: Custom AST parser (too much work), HTML + terminal HTML renderer (overhead, extra dependency).

**D2: Render markdown only for assistant messages**
- Rationale: User messages are typically short, conversational input. Assistant messages are the ones with complex LLM-formatted output (code blocks, structured lists). Keeping it focused avoids unnecessary processing.
- Alternatives considered: Render markdown for all roles.

**D3: Use `marked` or `remarkable` as the markdown parser underneath `ink-markdown`**
- Rationale: `ink-markdown` delegates parsing to its configured markdown library. Default `marked` is fast and well-maintained.
- Decision: Use default `marked` via `ink-markdown` unless specific features require switching.

**D4: Wrap markdown in its own module `src/tui/markdownRenderer.js`**
- Rationale: Follows the existing pattern of separating concerns (`messages.js` handles message formatting, `markdownRenderer.js` handles markdown-specific rendering). Keeps `conversationPanel.js` clean.

## Risks / Trade-offs

- **Long code blocks may overflow the terminal** → `ink-markdown` respects max width of parent `Box` (90% on the bubble). Scrolling handles overflow.
- **Markdown with nested/complex nesting may render poorly in TTY** → We limit to commonmark + GFM subset. Nested blockquotes and tables are not targeted in v1.
- **Performance: markdown parsing on every render** → Acceptable for typical message sizes (< 500 lines). Parsing is synchronous and fast.

## Open Questions

- None at this time.
