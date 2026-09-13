# STREAMING

Behavior of how streaming messages are received and coalesced into segments.

## Context

Streaming events arrive as a sequence of segments, each of `type` `message` or
`reasoning`. The TUI coalesces them into ordered segments per message bubble.

The coalescing rule (in `src/tui/messageList.js` `updateMessage`) is type-based:
- If the last segment has the same `type` as the incoming segment → **append** content.
- Otherwise → **push** a new segment.

This produces **mingled rendering**: reasoning blocks appear inline between
message chunks as they arrive, preserving the interleaved order of the stream.
This is intentional for long-running responses where reasoning and message
content alternate over time.

The only filtering applied is dropping **trivial reasoning noise** — a reasoning
segment with no alphanumeric content (e.g., a bare `.` or `""` fragment) is
dropped rather than rendered as a visible `💭 .` thinking line. A trivial chunk
that continues existing reasoning (e.g., the period ending a thought) is still
appended.

## Behavior

| type | previous segment | current segment | result |
|------|------------------|-----------------|--------|
| message | message | message | Append content to last message segment |
| message | reasoning | message | Push new message segment (new block) |
| message | (none) | message | Push new message segment (first block) |
| reasoning | reasoning | reasoning | Append content to last reasoning segment |
| reasoning | message | reasoning | Push new reasoning segment (new block) |
| reasoning | (none) | reasoning | Push new reasoning segment (first block) |
| reasoning | (any) | reasoning (trivial) | Drop segment — no alphanumeric content (bare punctuation/whitespace, e.g., `💭 .`) |
