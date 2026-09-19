## Context

The TUI renders assistant reasoning segments in `src/tui/messageBubble.js`. At render time, line 282 prepends a unicode character `💭 ` to the reasoning segment content: `React.createElement(Text, { color: "gray" }, `💭 ` + seg.content)`. This is the single source of the prefix — the data layer (`src/tui/conversationArea.js`, `src/stream/transformers/turn.js`) only produces `{ type: "reasoning", content }` segments and never adds the prefix.

The issue (#1110) is a cosmetic one: the unicode prefix clutters the reasoning display and is not part of the data model. It should be removed while keeping reasoning visually distinct from message content.

## Goals / Non-Goals

**Goals:**
- Remove the `💭 ` prefix from reasoning segment rendering.
- Keep the gray color (`color: "gray"`) and offset styling (`marginLeft: 2`) so reasoning remains visually distinct.
- Update the stale comment in `src/tui/messageList.js` that references "separate 💭 blocks".
- Add a test asserting reasoning segments render without the `💭 ` prefix.

**Non-Goals:**
- No change to the reasoning coalescing logic in `messageList.js` (comment only).
- No change to the data layer that produces `{ type: "reasoning", content }` segments.
- No change to gray color or offset styling.

## Decisions

**Decision: Remove the prefix at the render layer only.**
The prefix is a pure presentation concern. The data layer correctly produces `{ type: "reasoning", content }` segments with no prefix. Removing it at the render layer is the minimal, correct fix. Alternatives considered:
- Removing it in the data layer would be wrong — the data layer never adds it, and the prefix is not part of the data model.
- Introducing a configurable prefix is YAGNI — no requirement exists for a configurable prefix.

**Decision: Keep gray color and offset styling.**
Reasoning must remain visually distinct from message content. The gray color and `marginLeft: 2` offset provide that distinction without the unicode character. Removing them would regress the visual hierarchy.

**Decision: Update the stale comment in `messageList.js`.**
The comment references "separate 💭 blocks" but the coalescing logic does not add any prefix. Updating it to "separate reasoning blocks" removes the unicode reference and avoids confusion.

## Risks / Trade-offs

- [No visual distinction for reasoning] → Mitigated by keeping gray color and offset styling.
- [Test relies on renderToString output] → The test asserts the rendered string does not contain `💭 ` and does contain the reasoning content, which is deterministic.
