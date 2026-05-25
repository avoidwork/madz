## Context

The TUI (terminal user interface) renders all LLM messages as plain text via Ink's `Text` component. Assistant responses frequently contain markdown formatting — headings, lists, bold, code blocks — which currently render as raw markup characters. The terminal cannot interpret raw markdown; a transformation layer is needed.

Current flow in `src/tui/conversationPanel.js`: message content is passed directly to `React.createElement(Text, ..., msg.content)`. No parsing or transformation occurs.

Ink is a React renderer for the terminal. It supports colors, bold, italic via props on `Text` and `Box` components, not raw ANSI codes. This means the renderer must produce React element trees, not pre-escaped text.

## Goals / Non-Goals

**Goals:**
- Parse assistant and system message content from markdown to terminal-formatted Ink components.
- Preserve message role-based rendering: user messages remain plain text; assistant and system messages are parsed.
- Accurate line counting for virtualized scroll in the conversation panel.
- Graceful degradation when markdown is malformed or empty.
- One new dependency (`markdown-it`) added via `npm install`.

**Non-Goals:**
- Support for user message markdown parsing (user input is rendered as-is).
- HTML-to-ASCII rendering of images.
- Interactive link clicking in the terminal.
- Full CommonMark compliance — only headings, bold, italic, lists, inline code, fenced code blocks, and horizontal rules are targeted.

## Decisions

### Decision 1: Use `markdown-it` with a custom renderer over a full markdown-to-terminal library

**Choice:** Use the `markdown-it` parser (well-maintained, excellent CommonMark compliance, ~200KB) with a custom renderer that outputs Ink-compatible React elements.

**Rationale:** Popular all-in-one terminal markdown libraries (e.g., `marked-terminal`, `markdown-it-terminal`) produce raw ANSI or fixed-width text. We need reactive React component trees so that Ink can handle colors, layout, and re-rendering natively. `markdown-it` produces a token stream we can map to `React.createElement` calls for the corresponding Ink component.

**Alternatives considered:**
- `marked`: Simpler, lighter (~50KB), but less CommonMark compliant. LLM-generated markdown can be idiomatic and edge-case-heavy — `markdown-it`'s stricter compliance reduces parsing bugs.
- `marked-terminal`: Converts markdown to ANSI pre-rendered text. Not compatible with Ink's component model — the text would not re-render on state changes.
- Custom tokenizer: More control but reinvents the CommonMark spec, which is error-prone.

### Decision 2: Renderer returns Ink component trees, not ANSI strings

**Choice:** `renderMarkdown` returns a React element (or array of elements) wrapping Ink's `Text` and `Box` components.

**Rationale:** Ink's `Text` component already handles ANSI escape codes internally when color/style props are set. Returning elements lets Ink's reconciliation handle rendering, scrolling, and performance. Pre-rendered ANSI text would bypass Ink's lifecycle and break virtualized scrolling recalculations.

**Alternatives considered:**
- Return ANSI-escaped plain text: Simpler to implement but incompatible with Ink's component model. Colors would render as raw escape codes on some terminals.

### Decision 3: Message role gating in the rendering layer, not the data layer

**Choice:** The `ConversationPanel` decides whether to call the markdown renderer based on `msg.role`. The `Message` type and data contract remain unchanged.

**Rationale:** Keeps the message schema stable. No changes to LangGraph state or memory modules. Only the TUI rendering layer knows about markdown formatting.

**Alternatives considered:**
- Add a `formatted: boolean` flag to the Message type: Proliferates across the codebase unnecessarily. The data layer should not know about rendering concerns.

### Decision 4: Use `markdown-it` as the markdown parser

**Choice:** Add `markdown-it` to `package.json` via `npm install markdown-it`.

**Rationale:** `markdown-it` is actively maintained, strictly CommonMark-conformant, and has a simple plugin-like API for custom tokens. The ~200KB size is acceptable. It is the most widely used Node.js markdown parser and the best fit for handling LLM output which can include subtle or non-standard markdown.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `markdown-it` adds a new dependency — increases bundle size | `markdown-it` is ~200KB, acceptable value for the rendered output quality |
| Deeply nested markdown could produce large React trees | Virtualized rendering in `ConversationPanel` already limits rendered DOM; only visible messages render |
| Custom Ink-to-markdown mapping could miss edge cases | Spec requires graceful degradation; malformed input falls back to plain text |
| Line counting for scroll must stay accurate | `countMessageLines` is updated to parse markdown structure and count blank lines introduced by headings/code blocks |

## Migration Plan

1. Add `markdown-it` to `package.json` via `npm install markdown-it`.
2. Create `src/tui/markdownRenderer.js` — standalone module with `renderMarkdown(text)` function.
3. Create `src/tui/ansi.js` — color/style utility for Ink component creation.
4. Update `src/tui/conversationPanel.js` — conditionally route assistant/system messages through `renderMarkdown`.
5. Update `src/tui/messages.js` — update `countMessageLines` and `calcVisibleCount` to account for markdown-formatted line expansion.
6. Write unit tests for `markdownRenderer.js` and `ansi.js`.
7. Update existing `tui.test.js` to cover formatted message rendering.
8. Run pre-commit hook (lint → format → tests → coverage).

No breaking changes to API contracts. The TUI is the only consumer affected.

## Open Questions

1. **Performance under heavy formatting**: If a single assistant message has hundreds of markdown elements, could the React reconciliation slow down rendering? Ink batches updates, so this is unlikely to be an issue. No optimization needed at this scope.
2. **Config-driven markdown enablement**: Should there be a `tui.renderAssistantMarkdown` config flag in `config.yaml`? For now, always enable for assistant/system messages. This can be added later if requested.
