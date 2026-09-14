# STREAMING

Behavior of how streaming messages are received and coalesced into segments.

## Context

Streaming events arrive as a sequence of segments, each of `type` `message` or
`reasoning`. The TUI coalesces them into ordered segments per message bubble.

Three layers participate:

- **`src/tui/conversationArea.js`** — `createStreamingHandler` translates raw
  stream events into segment updates.
- **`src/tui/messageList.js`** — `updateMessage` coalesces incoming segments
  into the stored segment array.
- **`src/tui/messageBubble.js`** — renders the segments (reasoning gets a gray
  `💭` prefix, message renders as MarkdownText).

## Event → Segment Mapping (`conversationArea.js`)

`createStreamingHandler` handles these event types:

| event type | segment produced |
|------------|------------------|
| `message` | `{ type: "message", content }` |
| `reasoning` | `{ type: "reasoning", content }` |
| `on_chat_model_stream` | `chunk.content` → message segment; `chunk.reasoning` → reasoning segment |
| `on_tool_start` / `on_tool_end` / `tool_result` / `on_tool_error` | tool call display state (not segments) |

Each message/reasoning event appends the raw event to the message's `events`
array, then pushes a single-segment update to `updateMessage`, which coalesces.

## Segment Coalescing (`messageList.js` `updateMessage`)

The coalescing rule differs by incoming segment type.

### Message segments

- If the immediately-previous segment is also a message → **append** content to it.
- Otherwise → **push** a new message segment (new block).

### Reasoning segments

Reasoning coalesces with the last reasoning segment **even if a message
interleaved between chunks** — the search walks backwards past any message
segments to find the last reasoning segment. This keeps continuous reasoning in
one `💭` block rather than splitting it.

- If a last reasoning segment exists **and** it ends with sentence-ending
  punctuation (`.`, `?`, `!`) **and** the new content starts with a capital
  letter → **push** a new reasoning segment (new block).
- Else if a last reasoning segment exists → **append** content to it.
- Else → **push** a new reasoning segment (first block).

## Committed Reasoning Accumulation (`conversationArea.js`)

Separate from segment coalescing, `committedReasoningRef` accumulates the
reasoning text that is saved to the session. It appends only when:

- The accumulated reasoning does **not** end with sentence-ending punctuation
  (`.`, `?`, `!`), **and**
- The new chunk does **not** start with a capital letter.

This prevents a new sentence from being glued onto the previous one.

## Rendering (`messageBubble.js`)

Segments render in order:

- Reasoning segments → gray `💭` prefix, offset (`marginLeft: 2`).
- Message segments → MarkdownText.

## Behavior Table

| incoming type | previous segment | result |
|---------------|------------------|--------|
| message | message | Append content to last message segment |
| message | reasoning | Push new message segment (new block) |
| message | (none) | Push new message segment (first block) |
| reasoning | last reasoning ends with `.`/`?`/`!` and new content starts with capital | Push new reasoning segment (new block) |
| reasoning | last reasoning exists (no sentence boundary) | Append content to last reasoning segment |
| reasoning | (none) | Push new reasoning segment (first block) |

> **Note:** No timing-based coalescing exists. The earlier `250ms` timeout
> proposal was never implemented — coalescing is driven purely by segment type
> and grammatical sentence boundaries.
