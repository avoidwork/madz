## Context

The agent system uses LangGraph state machines with turn hash tracking to detect repetitive loops. When a duplicate turn hash is found in the sliding window, a `loop_detected` event is emitted. Currently, this event is only handled by the TUI for display purposes — the agent never receives feedback that it is stuck.

The loop detection lives in `src/agent/react.js` in the `checkTurnHash` function. The TUI handles the event in `src/tui/app.js` by appending "You're looping." to the last assistant message display. The agent continues its loop because it has no visibility into the detection.

## Goals / Non-Goals

**Goals:**
- Inject a configurable nudge message into the conversation when a loop is detected.
- The nudge message is visible to the agent as a `user` message.
- Track and enforce a maximum nudge count.
- Keep the existing UI nudge display unchanged.

**Non-Goals:**
- Changing the loop detection algorithm itself.
- Adding loop recovery strategies beyond the nudge.
- Changing the UI nudge display.
- Persisting nudge count across sessions.

## Decisions

1. **Nudge as user message:** The nudge is injected as a `user` message type so the agent sees it as conversation input. This is more natural than a `system` message because it feels like feedback from the user. Alternative: `system` message — rejected because the agent may ignore system messages or treat them differently.

2. **Nudge count in LangGraph state:** The nudge counter is stored in the LangGraph state object so it persists across turns and is available when `loop_detected` is emitted. Alternative: separate session metadata — rejected because the state is already passed through all nodes and is the natural place for turn-related tracking.

3. **Inject nudge at loop detection point:** The nudge is injected directly in `src/agent/react.js` when `loop_detected` is emitted, rather than in the TUI or a separate handler. This ensures the nudge is added to the conversation before the next agent turn begins. Alternative: inject in a separate node — rejected because it would require changing the graph structure and adding a new node.

4. **Default loop limit of 5:** After 5 nudges, the system stops injecting them but continues detecting loops (for UI purposes). This gives the agent multiple chances to break the loop while preventing infinite nudge injection. Alternative: unlimited nudges — rejected because it could lead to conversation pollution. Alternative: limit of 1 — rejected because the agent may need multiple attempts to break the loop.

5. **No repetition context in nudge:** The nudge message does not include repetition context (e.g., which turns were repeated). It's a simple, direct message. This keeps the nudge concise and avoids confusing the agent with technical details.

## Risks / Trade-offs

- **Risk:** The nudge message adds to the conversation context, potentially consuming tokens. → **Mitigation:** The nudge is a short message, and the limit of 5 keeps it bounded.
- **Risk:** The agent may not respond to the nudge and continue looping. → **Mitigation:** After 5 nudges, no more are injected. The UI still shows the loop indicator.
- **Risk:** The nudge count in state may not persist if the state is reset. → **Mitigation:** The state is part of the LangGraph session and persists across turns within a session.
- **Trade-off:** Using a `user` message means the nudge is indistinguishable from actual user input to the agent. → **Mitigation:** This is intentional — it makes the nudge feel like natural feedback.

## Migration Plan

This is a backward-compatible change. The new config fields are optional with sensible defaults. No migration is needed — existing configurations will continue to work, and the default nudge message will be used if `loopMsg` is not configured.

## Open Questions

- Should the nudge count be reset when the conversation is cleared? (Yes, by design — the state is reset.)
- Should there be a way to disable loop detection entirely? (Not in this change — the existing `turnHashWindow` config can be set to 0 to disable.)