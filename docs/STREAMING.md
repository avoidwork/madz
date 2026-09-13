# STREAMING

Behavior of how streaming messages are received and coalesced into segments.

## Context

Streaming events arrive as a sequence of segments, each of `type` `message` or
`reasoning`. The TUI coalesces them into ordered segments per message bubble.

Current coalescing rule (in `src/tui/messageList.js` `updateMessage`):
- If the last segment has the same `type` as the incoming segment → **append** content.
- Otherwise → **push** a new segment.

No timing-based logic exists yet.

> **Note:** The `250ms` timeout in the Desired Behavior table is **provisional**. It was chosen from a simulation of synthetic gap distributions (continuations ~80ms, new blocks ~650ms). The ranking of the rules is robust, but the optimal timeout is sensitive to the real gap distribution. Instrument the live stream to log actual gaps between segments, then tune the timeout against measured data.

## Current Behavior

| type | append | previous segment | current segment | result |
|------|--------|------------------|-----------------|--------|
| message | yes | message | message | Append content to last message segment |
| message | no | reasoning | message | Push new message segment (new block) |
| message | no | (none) | message | Push new message segment (first block) |
| reasoning | yes | reasoning | reasoning | Append content to last reasoning segment |
| reasoning | no | message | reasoning | Push new reasoning segment (new block) |
| reasoning | no | (none) | reasoning | Push new reasoning segment (first block) |

## Desired Behavior

| type | append | previous segment | current segment | result |
|------|--------|------------------|-----------------|--------|
| message | yes | message | message | Append content to last message segment |
| message | maybe | reasoning | message | Append to last message segment if it exists, doesn't end with sentence-ending punctuation (`.`, `!`, `?`), and arrived within 250ms of the last message segment; otherwise push a new message segment (new block) |
| message | no | (none) | message | Push new message segment (first block) |
| reasoning | yes | reasoning | reasoning | Append content to last reasoning segment |
| reasoning | maybe | message | reasoning | Append to last reasoning segment if one exists and arrived within 250ms of the last reasoning segment; otherwise push a new reasoning segment (new block) |
| reasoning | no | (none) | reasoning | Push new reasoning segment (first block) |
