# Design

## Context

See proposal.md - Why. The bug is that `MessageBubble` renders the `time` prop verbatim at `src/tui/messageBubble.js:393` (`const ts = time || formatTime(new Date());`). The live path passes a pre-formatted localized string (via `getTimestamp()` → `formatTime(new Date())`), while the session-restore paths pass `exchange.timestamp`, which is the raw ISO8601 string stored by `SessionStateManager.addExchange()`. The two paths diverge because formatting is applied at the live call site but never at the restore site.

## Goals / Non-Goals

**Goals:**
- Centralize timestamp formatting at the bubble render so any timestamp source renders identically.
- Accept a raw timestamp (`Date` or ISO8601 string) via the `time` prop.
- Preserve the existing fallback to `formatTime(new Date())` for invalid/missing timestamps.

**Non-Goals:**
- Changing ISO8601 storage in `stateManager.js`.
- Altering `formatTime` locale/timezone behavior.
- Any change to the SUBAGENTS panel rendering path beyond honoring the new `time` contract.

## Decisions

### Decision 1: The bubble owns the formatting

**Choice:** `MessageBubble` accepts a raw timestamp and formats it at render time using `formatTime()`.

**Rationale:** This is the single-responsibility approach. Storage stores ISO8601 (the source of truth); the display layer formats it. Moving formatting into the bubble means any caller — live, restored, or subagent — gets identical output without each call site remembering to format.

**Alternatives considered:**
- *Normalize at each call site* (pass `formatTime(new Date(exchange.timestamp))` in the restore paths). Rejected because it keeps formatting scattered across call sites and re-introduces the divergence risk for future callers.
- *Format in `stateManager` on read.* Rejected because it couples storage to display and would require changing the stored format.

### Decision 2: The `time` prop contract changes to accept a raw timestamp

**Choice:** Change the `time` prop from "pre-formatted localized string" to "raw timestamp (`Date` or ISO8601 string)".

**Rationale:** This is the minimal contract that lets the bubble format uniformly. The only callers are within `conversationArea.js` (live path and restore paths), all of which we control.

**Alternatives considered:**
- *Keep the prop as a formatted string and add a separate raw-timestamp prop.* Rejected as redundant — two props for one concept.

### Decision 3: Live path passes a raw `Date`

**Choice:** Update the live path (`getTimestamp()` and the `addMessage` calls that pass `time`) to pass a raw `Date` rather than a pre-formatted string.

**Rationale:** This makes both paths converge on the same contract. `getTimestamp()` currently returns `formatTime(new Date())`; it will instead return `new Date()` (or the call sites will pass `new Date()` directly).

**Alternatives considered:**
- *Keep the live path passing a formatted string and have the bubble detect the format.* Rejected as fragile — the bubble would need to distinguish a formatted string from an ISO8601 string.

## Risks / Trade-offs

- [Changing the `time` prop contract] → Mitigation: The only callers are within `conversationArea.js` and the session-restore paths, all under our control. The SUBAGENTS panel renders `MessageBubble` without a `topic`; it will be checked to ensure it passes a raw timestamp or is unaffected.
- [Invalid/missing timestamps in older sessions] → Mitigation: The bubble falls back to `formatTime(new Date())` when the timestamp cannot be parsed as a valid date.
- [`formatTime` receiving an invalid `Date`] → Mitigation: Guard with `Number.isNaN(date.getTime())` before formatting, falling back to the current time.

## Migration Plan

No data migration. The stored ISO8601 timestamps remain valid inputs to the new contract. The change is purely in the display layer and the `time` prop call sites.

## Open Questions

None.
