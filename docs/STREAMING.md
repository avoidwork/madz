# STREAMING

Behavior of how streaming messages are received and coalesced into segments.

## Context

Streaming events arrive as a sequence of segments, each of `type` `message` or
`reasoning`. The TUI coalesces them into ordered segments per message bubble.

Four layers participate:

- **`index.js`** — `callProvider` / `resumeProvider` translate raw graph stream
  events into `message` / `reasoning` / `tool` events, threading a stable block
  identifier through each.
- **`src/tui/conversationArea.js`** — `createStreamingHandler` translates those
  events into segment updates for the orchestrator's assistant bubble.
- **`src/tui/subagentStore.js`** — `updateSubagentStore` folds `subagent_*`
  events into the SUBAGENTS panel store.
- **`src/tui/messages.js`** — `coalesceSegments` is the shared coalescing
  routine used by both `messageList.js` and `subagentStore.js`.
- **`src/tui/messageList.js`** — `updateMessage` delegates to `coalesceSegments`
  to fold incoming segments into the stored segment array.
- **`src/tui/messageBubble.js`** — renders the segments (reasoning gets a gray
  `💭` prefix, message renders as MarkdownText).

## Stable block identity (`index.js`)

A streamed text block is split across multiple chunks. The provider assigns each
block a stable identifier so chunks belonging to the same block can be
reassembled.

- **Reasoning blocks** carry an `id` (`block.id`), emitted as `id` on the
  `reasoning` event.
- **Message text blocks** carry an `index` (`block.index`, the content-block
  index), emitted as `index` on the `message` event.

Both are threaded through the event so the TUI can coalesce by block identity
rather than by type alone.

## Event → Segment Mapping (`conversationArea.js`)

`createStreamingHandler` handles these event types:

| event type                                                        | segment produced                                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `message`                                                         | `{ type: "message", content, id? }` — `id` is set from `event.index`                                       |
| `reasoning`                                                       | `{ type: "reasoning", content, id? }` — `id` is set from `event.id`                                        |
| `on_chat_model_stream`                                            | `chunk.content` → message segment; `chunk.reasoning` → reasoning segment (no `id` — Chat Completions path) |
| `on_tool_start` / `on_tool_end` / `tool_result` / `on_tool_error` | tool call display state (not segments)                                                                     |

The `index` → `id` normalization happens at the segment-construction site: the
message segment spreads `{ id: event.index }` when `event.index` is present, and
the reasoning segment spreads `{ id: event.id }` when `event.id` is present. This
keeps the downstream coalescing logic uniform — every segment that carries a
block identity uses the `id` field.

`subagentStore.js` performs the same normalization for `subagent_message`
(`{ id: event.index }`) and `subagent_reasoning` (`{ id: event.id }`).

Each message/reasoning event appends the raw event to the message's `events`
array, then pushes a single-segment update to `updateMessage`, which coalesces.

## Segment Coalescing (`messages.js` `coalesceSegments`)

The coalescing rule differs by incoming segment type. Both `messageList.js`
`updateMessage` and `subagentStore.js` `updateSubagentStore` call this shared
routine.

### Message segments

Message segments coalesce by identity:

- If the new segment carries an `id`, it appends to the **last message segment
  with the same `id`** — a streamed text block is split across chunks that share
  an id, so they merge into one block. A new or absent id starts a new block.
- If the new segment has **no `id`**, it falls back to a type match: append to
  the immediately-previous segment if it is also a message, otherwise push a new
  message segment (new block).

### Reasoning segments

Reasoning coalesces with the last reasoning segment **even if a message
interleaved between chunks** — the search walks backwards past any message
segments to find the last reasoning segment. This keeps continuous reasoning in
one `💭` block rather than splitting it.

- If the new segment carries an `id`, it appends to the **last reasoning segment
  with the same `id`**. A new or absent id starts a new block.
- If the new segment has **no `id`** (e.g. Chat Completions `reasoning_content`,
  a continuous string with no block boundaries), it falls back to a grammatical
  sentence boundary: if the last reasoning segment ends with `.`/`?`/`!` **and**
  the new content starts with a capital letter → push a new reasoning segment;
  otherwise append to the last reasoning segment.

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

| incoming type | carries id | previous segment                                                         | result                                   |
| ------------- | ---------- | ------------------------------------------------------------------------ | ---------------------------------------- |
| message       | yes (id)   | last message with same id                                                | Append content to that message segment   |
| message       | yes (id)   | no message with same id                                                  | Push new message segment (new block)     |
| message       | no         | message                                                                  | Append content to last message segment   |
| message       | no         | reasoning                                                                | Push new message segment (new block)     |
| message       | no         | (none)                                                                   | Push new message segment (first block)   |
| reasoning     | yes (id)   | last reasoning with same id                                              | Append content to that reasoning segment |
| reasoning     | yes (id)   | no reasoning with same id                                                | Push new reasoning segment (new block)   |
| reasoning     | no         | last reasoning ends with `.`/`?`/`!` and new content starts with capital | Push new reasoning segment (new block)   |
| reasoning     | no         | last reasoning exists (no sentence boundary)                             | Append content to last reasoning segment |
| reasoning     | no         | (none)                                                                   | Push new reasoning segment (first block) |

> **Note:** No timing-based coalescing exists. The earlier `250ms` timeout
> proposal was never implemented — coalescing is driven purely by block identity
> (`id`) and, where no `id` is present, by segment type and grammatical sentence
> boundaries.
