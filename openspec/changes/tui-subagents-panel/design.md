## Context

The TUI currently renders all stream events into a single assistant bubble. When the orchestrator delegates via the `task` tool, the subagent's reasoning and message segments are flattened into the same bubble as the orchestrator's output because the stream namespace is discarded in `callProvider` (`index.js`). With `subgraphs: true`, `agent.stream()` yields `[namespace, mode, payload]` where the root graph has an empty namespace and each subagent subgraph has a populated namespace (e.g. `["task:<uuid>"]`).

## Goals / Non-Goals

**Goals:**
- Capture the stream namespace in `callProvider` so subagent activity is distinguishable from the root graph.
- Emit dedicated `subagent_*` event types carrying the namespace for subagent reasoning, message, and tool activity.
- Route `subagent_*` events to a dedicated subagent store in the TUI, not the orchestrator's assistant bubble.
- Add a `SUBAGENTS` panel that renders each subagent's reasoning/message segments and tool calls.
- Wire the panel into the App render switch.

**Non-Goals:**
- Not changing the orchestrator's conversation bubble behavior for root-graph events.
- Not adding new npm packages or dependencies.
- Not altering subagent delegation logic in `src/agent/deepAgents.js`.

## Decisions

### Decision 1: Emit subagent event types at the source (`callProvider`)
The namespace is only available at the `agent.stream()` iteration site in `callProvider`. By the time events reach the TUI handler, the namespace is lost. Therefore, the capture must happen in `callProvider`. When `namespace.length > 0`, emit `subagent_message`, `subagent_reasoning`, `subagent_tool_start`, `subagent_tool_end` carrying the namespace. The root graph (empty namespace) continues to emit the existing `message`/`reasoning`/`on_tool_*` event types.

**Alternatives considered:** Routing the namespace through the existing event types (e.g. adding a `namespace` field to `message`/`reasoning`). Rejected because it would require the TUI handler to branch on a field for every event and would not cleanly separate subagent tool activity from orchestrator tool activity.

### Decision 2: Route subagent events to a dedicated store in the TUI
In `createStreamingHandler` (`src/tui/conversationArea.js`), handle the new `subagent_*` event types by routing them to a dedicated subagent store keyed by namespace, not to `streamingMsgIdRef.current`. This keeps the orchestrator's assistant bubble clean while capturing subagent activity separately.

**Alternatives considered:** Folding subagent events into the same bubble with a namespace prefix. Rejected because it defeats the purpose of separating subagent activity from the orchestrator's conversation.

### Decision 3: Dedicated `SUBAGENTS` panel
Add `SUBAGENTS` to `PANELS` and register it in `getPanelOrder()`. Create `src/tui/subagentsPanel.js` rendering each subagent's reasoning/message segments and tool calls, reusing `MessageBubble` or a variant. This is consistent with the existing panel system (SKILLS/MEMORIES/SETTINGS/SESSIONS/PROJECTS).

**Alternatives considered:** Inline collapsible sections in the conversation (busier, harder to scan); a second always-visible message list (more complex layout). The dedicated panel provides clean separation and is consistent with the existing panel architecture.

## Risks / Trade-offs

- [Subagent events emitted before the subagent store is initialized] → The store is created lazily on first subagent event; events for unknown namespaces create a new entry.
- [Multiple subagents in one turn] → The store is keyed by namespace, so each subagent gets its own entry.
- [Nested subagent delegation] → Each subgraph has a distinct namespace, so nested subagents are captured separately.
- [Subagent tool calls with errors] → `subagent_tool_end` carries the namespace; the panel renders tool activity per subagent.
