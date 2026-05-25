## Context

The TUI renders conversation messages using `ink`'s `Text` component with plain string content. Users send markdown messages and receive markdown-formatted assistant responses (code blocks, bold, lists, headings, inline code), but these display as raw markdown text with no visual formatting.

`ink-markdown` (https://github.com/knagg/ink-markdown) is a React component that renders CommonMark markdown into terminal-compatible Ink components.

## Goals / Non-Goals

**Goals:**
- Render markdown syntax as formatted terminal output in the conversation panel
- Support the subset of CommonMark useful for AI chat: bold, italic, code blocks, inline code, lists, headings, blockquotes, links
- Gracefully degrade: unrecognized or complex markdown falls back to plain text
- Minimal architectural change — no new subsystems, state, or protocol changes

**Non-Goals:**
- Syntax highlighting inside code blocks
- Tables (not useful in terminal width-constrained TUI)
- Configurable markdown theme or colors (use existing role colors)
- Server-side markdown rendering

## Decisions

### Decision: Use ink-markdown npm package
- **Choice**: Install `ink-markdown` and wrap it in a custom `MarkdownText` component
- **Rationale**: Provides pre-built markdown-to-Ink rendering. Homegrown would duplicate significant logic. `ink-markdown` is lightweight and designed specifically for the Ink ecosystem.
- **Alternatives considered**:
  - Custom renderer: Too complex for the subset of markdown needed, high maintenance burden.
  - ansi-markdown or other packages: Either unmaintained or built for non-Ink renderers.

### Decision: Wrap Markdown in MarkdownText component
- **Choice**: Create `src/tui/markdownText.js` exporting `MarkdownText({ children })` that uses `<Markdown from="ink-markdown">` internally
- **Rationale**: Keeps the Ink-markdown API consistent with existing TUI components and allows adding features (line-wrapping, color overrides) in one place if needed later.
- **Integration**: In `ConversationPanel`, replace `Text({ wrap: "true" }, msg.content)` with `MarkdownText` wrapping a Text node.

### Decision: Pass through raw content without pre-formatting
- **Choice**: `messages.js` `formatMessage` and `ConversationPanel` use `msg.content` raw — no escaping or pre-processing.
- **Rationale**: `ink-markdown`'s `Markdown` component handles raw markdown strings natively. Pre-formatting would escape markers before markdown parsing.

## Risks / Trade-offs

|Risk|Mitigation|
|---|---|
|`ink-markdown` could be unmaintained|Pin version in package.json, monitor issues; fallback to plain Text is always available|
|Complex markdown (tables, HTML) may render poorly in terminal|Limit scope to CommonMark subset; markdown library handles unknown syntax by falling back to text nodes|
|Scroll measurement changes due to rendered formatting affecting line wrapping|`ink-scroll-view` measures text nodes; markdown rendering should produce the same `Text` count per line |
|Additional package size in a TUI app|`ink-markdown` is small (~15KB gzipped); negligible impact|
