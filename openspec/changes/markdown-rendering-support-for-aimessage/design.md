## Context

The TUI (terminal user interface) renders all LLM messages as plain text via Ink's `Text` component. Assistant responses frequently contain markdown formatting — headings, lists, bold, code blocks — which currently render as raw markup characters. We need Ink-native components that handle Markdown rendering.

Current flow in `src/tui/conversationPanel.js`: message content is passed directly to `React.createElement(Text, ..., msg.content)`. No parsing or transformation occurs.

## Goals / Non-Goals

**Goals:**
- Render assistant and system message content as formatted Markdown in the TUI conversation panel.
- Preserve message role-based rendering: user messages remain plain text; assistant and system messages are parsed as Markdown.
- Accurate line counting for virtualized scroll in the conversation panel.
- Graceful degradation when markdown is malformed or empty.

**Non-Goals:**
- Support for user message markdown parsing (user input is rendered as-is).
- HTML-to-ASCII rendering of images.
- Interactive link clicking in the terminal.
- Full CommonMark compliance — only headings, bold, italic, lists, inline code, fenced code blocks, and horizontal rules are targeted.

## Decisions

### Decision 1: Use `ink-markdown` package

**Choice:** Use the `ink-markdown` package to render Markdown as Ink components.

**Rationale:** `ink-markdown` is purpose-built for thisexact use case — it wraps `marked` + `marked-terminal` and outputs React elements compatible with Ink's component model. Building a custom parser would be error-prone and much more code. The package is only ~3KB, well-maintained, and handles all the required markdown syntax.

**Alternatives considered:**
- `markdown-it` + custom renderer: Complex, reinvents the wheel. Overkill for the syntax scope needed.
- `marked` + `marked-terminal` alone: Produces styled terminal text, but doesn't produce Ink React components. `ink-markdown` is the proper bridge.
- Custom regex-based parser: Fragile with nested formatting. No benefit over the existing package.

### Decision 2: Message role gating in the rendering layer, not the data layer

**Choice:** The `ConversationPanel` decides whether to call the markdown renderer based on `msg.role`. The `Message` type and data contract remain unchanged.

**Rationale:** Keeps the message schema stable. No changes to LangGraph state or memory modules. Only the TUI rendering layer knows about markdown formatting.

**Alternatives considered:**
- Add a `formatted: boolean` flag to the Message type: Proliferates across the codebase unnecessarily. The data layer should not know about rendering concerns.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `ink-markdown` adds a new dependency | `ink-markdown` is ~3KB with `marked` and `marked-terminal` as deps. Well-maintained and stable. |
| Deeply nested markdown could produce large React trees | Virtualized rendering in `ConversationPanel` already limits rendered elements; only visible messages render |
| Markdown formatting may not match terminal rendering expectations | `ink-markdown` is tested and designed for Ink. Handles edge cases gracefully. |
| Line counting for scroll must stay accurate | `countMessageLines` is updated to account for potential line expansion from markdown formatting |

## Migration Plan

1. Add `ink-markdown` to `package.json` via `npm install ink-markdown`.
2. Update `src/tui/conversationPanel.js` — import `ink-markdown`, and conditionally render assistant/system messages through the Markdown component.
3. Update `src/tui/messages.js` — update `countMessageLines` to account for potential line expansion from markdown formatting.
4. Write unit tests for the markdown rendering integration.
5. Run pre-commit hook (lint → format → tests → coverage).

No breaking changes to API contracts. The TUI is the only consumer affected.

## Open Questions

1. **Performance under heavy formatting**: If a single assistant message has hundreds of markdown elements, could the React reconciliation slow down rendering? Ink batches updates, so this is unlikely to be an issue. No optimization needed at this scope.
2. **Config-driven markdown enablement**: Should there be a `tui.renderAssistantMarkdown` config flag in `config.yaml`? For now, always enable for assistant/system messages. This can be added later if requested.
