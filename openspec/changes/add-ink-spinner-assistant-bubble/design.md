## Context

The `MessageBubble` component (`src/tui/messageBubble.js`) renders assistant and user messages in the TUI. It tracks streaming chunks via a `chunks` state array (line 128), populated through a pub/sub subscription (lines 133-147). When `chunks.length === 0 && !content`, the bubble is in a "pending" state — no content has arrived yet. Currently, this state renders an empty bubble with no visual feedback.

The project uses Ink for TUI rendering. The existing TUI theme uses cyan for assistant labels and gray for timestamps/metadata. The `MarkdownText` component (line 231) renders streamed content.

## Goals / Non-Goals

**Goals:**
- Add `ink-spinner` dependency
- Render an animated spinner in the assistant response bubble during the pending state
- Spinner hides automatically when first chunk arrives, on abort, or on interruption
- Style the spinner consistent with the existing TUI theme (cyan, "Thinking" label)

**Non-Goals:**
- No changes to the pub/sub system or MessageList
- No changes to the MessageBubble component's props or state shape
- No custom spinner implementation — use `ink-spinner` package
- No spinner for user or system messages (assistant only)

## Decisions

1. **Use `ink-spinner` package** — The issue explicitly requests this lightweight Ink-compatible package. It provides animated spinner types (dots2, lines, dots) without requiring custom animation logic.

2. **Spinner type: `dots2`** — Provides a subtle, non-distracting animation. The issue example uses `dots2`.

3. **Conditional rendering via existing state** — No new state variables. The condition `chunks.length === 0 && !content` already exists implicitly (line 150: `const text = chunks.at(-1) || content || ""`). The spinner renders when `text === ""` and `role === "assistant"`.

4. **Placement: inside the inner Box, alongside MarkdownText** — The spinner and MarkdownText share the same Box container (lines 228-232). When the spinner is visible, MarkdownText receives empty content and renders nothing. When the first chunk arrives, the spinner disappears and MarkdownText renders the content. No layout reflow because Ink's rendering model only re-renders changed nodes.

5. **Styling: cyan color, "Thinking" text** — Consistent with the existing TUI theme where assistant labels use cyan. The spinner text "Thinking" mirrors the "thinking" label used for reasoning content (line 167).

## Risks / Trade-offs

- **[Risk]** ink-spinner may have peer dependency conflicts with the project's Ink version.
  **Mitigation:** Check npm install output; if incompatible, pin a compatible version or use an alternative spinner package.

- **[Risk]** Spinner animation may cause terminal flicker in some terminal emulators.
  **Mitigation:** ink-spinner uses ANSI escape sequences that should be compatible with most terminals. Test in the project's target terminal environment.

- **[Trade-off]** Spinner only for assistant messages, not user messages.
  **Rationale:** User messages are instant (no processing delay). Assistant messages are the only ones with a perceptible wait time.

## Migration Plan

This is a pure visual addition with no breaking changes:
1. Install `ink-spinner`
2. Modify `messageBubble.js` to import and conditionally render the spinner
3. No migration needed — existing behavior is preserved, spinner is additive

## Open Questions

- None identified. The implementation is straightforward: add dependency, add conditional render.
