# STREAMING

Behavior of how streaming messages are received and coalesced into segments.

## Context

Streaming events arrive as a sequence of segments, each of `type` `message` or
`reasoning`. The TUI coalesces them into ordered segments per message bubble.

Current coalescing rule (in `src/tui/messageList.js` `updateMessage`):
- If the last segment has the same `type` as the incoming segment → **append** content.
- Otherwise → **push** a new segment.

No timing-based logic exists yet.

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
| message | no | reasoning | message | Append to last message segment if it exists and doesn't end with sentence-ending punctuation (`.`, `!`, `?`); otherwise push a new message segment (new block) |
| message | no | (none) | message | Push new message segment (first block) |
|      |        |                  |                 |        |
