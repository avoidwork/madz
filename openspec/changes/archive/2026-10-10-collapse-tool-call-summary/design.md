## Context

The message bubble renders a completed-tool-calls summary line. Today `completedToolCalls` is a flat `string[]` that accumulates one entry per `on_tool_end` event in `src/tui/conversationArea.js`. The bubble joins them with `, `, so a turn that calls `read_file` 10 times renders `read_file, read_file, read_file, ...`. The height estimator in `src/tui/messageList.js` checks `.length > 0` to decide whether the summary row exists.

## Goals / Non-Goals

**Goals:**
- Collapse repeated tool calls into a count map so the summary reads `⚡ N tool calls: read_file ×10, searchCode`.
- Hide `×1` for tools called once.
- Preserve insertion order (first-call order).
- Normalize legacy array-shaped calls on session restore so old transcripts render correctly.
- Keep the height estimator correct for the new shape.

**Non-Goals:**
- Changing the `activeToolCall` "Running: ..." indicator.
- Changing the `toolCallDisplay` result lines.
- Any change to the status bar.
- Sorting by count descending.

## Decisions

### Decision 1: Aggregate at the source, not at render time

`completedToolCalls` becomes a `{ [name]: count }` object in `conversationArea.js`. The `on_tool_end` handler increments `completedToolCalls[event.name]` and publishes a shallow copy.

**Why:** The count is computed once as events arrive, not recomputed on every render. The object is also more compact for session persistence than a long array.

**Alternatives considered:**
- Keep the flat array and compute counts at render time — rejected because the array still travels through the data path and the count is recomputed on every render.

### Decision 2: Shared helpers in `src/tui/messages.js`

Add `normalizeCompletedToolCalls(calls)`, `hasCompletedToolCalls(calls)`, and `formatCompletedToolCalls(calls)`.

**Why:** The bubble render, the height estimator, and the session-restore path all need the same normalization. One implementation avoids drift.

### Decision 3: Preserve insertion order, hide `×1`

`formatCompletedToolCalls` iterates `Object.keys(map)` (insertion order) and omits the `×1` suffix for counts of 1.

**Why:** The summary reads as a record of what happened, not a ranking. Sorting by count would reorder mid-stream as counts change.

### Decision 4: Normalize on session restore

`setMessages` in `messageList.js` wraps `m.completedToolCalls` with `normalizeCompletedToolCalls`.

**Why:** Old transcripts store arrays. Normalizing at the boundary keeps the rest of the code path object-only.

## Risks / Trade-offs

- **[A turn using 30+ distinct tools still produces a long summary]** → Mitigation: rare; a `+N more` truncation is a cheap future add if it ever bites.
- **[Height estimator regresses if the shape check is missed]** → Mitigation: switch the `.length > 0` check to `hasCompletedToolCalls`, which handles both shapes.
- **[Legacy transcripts break if not normalized]** → Mitigation: normalize in `setMessages`; `normalizeCompletedToolCalls` accepts both array and object.
