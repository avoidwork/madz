## Why

When the orchestrator delegates work via the `task` tool, the subagent's reasoning and message segments are currently flattened into the same assistant bubble as the orchestrator's own output. The stream namespace that identifies which subgraph produced each event is discarded in `callProvider`, so there is no way to distinguish what the orchestrator said from what each subagent did. This makes multi-agent runs hard to follow and audit.

## What Changes

- Capture the stream namespace in `callProvider` (`index.js`) so subagent subgraphs can be distinguished from the root graph.
- When the namespace is populated (subagent activity), emit new event types (`subagent_message`, `subagent_reasoning`, `subagent_tool_start`, `subagent_tool_end`) carrying the namespace, instead of the flat `message`/`reasoning`/`on_tool_*` events.
- Keep the root graph (empty namespace) emitting the existing event types unchanged.
- Route `subagent_*` events in the TUI streaming handler to a dedicated subagent store keyed by namespace, not to the orchestrator's assistant bubble.
- Add a `SUBAGENTS` panel to the TUI that renders each subagent's reasoning/message segments and tool calls.
- Wire the `SUBAGENTS` panel into the App render switch.

## Capabilities

### New Capabilities
- `tui-subagents-panel`: A dedicated TUI panel that captures and renders each subagent's reasoning and message segments separately from the orchestrator's conversation, including subagent tool calls.

### Modified Capabilities
- `tui-streaming`: The streaming handler must route subagent events to a dedicated subagent store instead of the orchestrator's assistant bubble.

## Impact

- `index.js` — `callProvider` captures the stream namespace and emits subagent event types.
- `src/tui/conversationArea.js` — `createStreamingHandler` routes `subagent_*` events to a subagent store.
- `src/tui/panels.js` — `PANELS` enum gains `SUBAGENTS`; `getPanelOrder()` registers it.
- `src/tui/subagentsPanel.js` — new panel rendering subagent activity.
- `src/tui/app.js` — render switch gains a `SUBAGENTS` branch.
- `tests/unit/tui/subagentsPanel.test.js` — new unit tests.

## Non-goals

- Not changing the orchestrator's conversation bubble behavior for root-graph events.
- Not adding new npm packages or dependencies.
- Not altering subagent delegation logic in `src/agent/deepAgents.js`.
