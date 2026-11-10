## Context

The synthetic cancelled ToolMessage has status "error" and a fixed text. Provider history must keep it so tool_call/tool_result pairing stays valid.

## Goals / Non-Goals

**Goals:** Hide it from the TUI live stream and restored history; keep token counting.
**Non-Goals:** Changing deepagents, or adding a new indicator.

## Decisions

- One detector module owns the regex; no other file duplicates it.
- Restored history carries a metadata flag (`cancelled: true`) set once in `toConversationExchange`; the TUI list checks the flag rather than matching text. Live stream events carry text only, so the event helper matches text (and requires status "error" when a status is present).
- Live: tokens are counted before the cancel check, so context accounting is unchanged.

## Risks / Trade-offs

- A real tool printing the exact text with status "error" would be hidden; negligible.
