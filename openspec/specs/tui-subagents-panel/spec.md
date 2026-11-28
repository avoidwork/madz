# tui-subagents-panel Specification

## Purpose
TBD - created by archiving change tui-subagents-panel. Update Purpose after archive.

## Requirements

### Requirement: callProvider SHALL capture the stream namespace
`callProvider` in `index.js` SHALL capture the `_namespace` from `agent.stream()` when iterating with `subgraphs: true`. When `namespace.length > 0`, it SHALL emit subagent event types carrying the namespace instead of the flat `message`/`reasoning`/`on_tool_*` events. The root graph (empty namespace) SHALL continue emitting the existing event types.

#### Scenario: Root graph emits existing event types
- **WHEN** `callProvider` iterates a stream event with an empty namespace (`[]`)
- **THEN** it emits the existing `message`, `reasoning`, `on_tool_start`, or `on_tool_end` event types

#### Scenario: Subagent emits subagent_message
- **WHEN** `callProvider` iterates a stream event with a populated namespace (e.g. `["task:<uuid>"]`) and mode `messages` with message text
- **THEN** it emits a `subagent_message` event carrying the namespace and text

#### Scenario: Subagent emits subagent_reasoning
- **WHEN** `callProvider` iterates a stream event with a populated namespace and reasoning content
- **THEN** it emits a `subagent_reasoning` event carrying the namespace and reasoning text

#### Scenario: Subagent emits subagent_tool_start
- **WHEN** `callProvider` iterates a stream event with a populated namespace and mode `tools` with `on_tool_start`
- **THEN** it emits a `subagent_tool_start` event carrying the namespace and tool name

#### Scenario: Subagent emits subagent_tool_end
- **WHEN** `callProvider` iterates a stream event with a populated namespace and mode `tools` with `on_tool_end`
- **THEN** it emits a `subagent_tool_end` event carrying the namespace and tool name

### Requirement: Subagent events SHALL carry the namespace
Each `subagent_*` event emitted by `callProvider` SHALL include the namespace that identifies the subgraph that produced it.

#### Scenario: Event carries namespace
- **WHEN** a `subagent_message` event is emitted
- **THEN** the event includes a `namespace` field equal to the populated namespace array

### Requirement: TUI streaming handler SHALL route subagent events to a subagent store
`createStreamingHandler` in `src/tui/conversationArea.js` SHALL handle `subagent_message`, `subagent_reasoning`, `subagent_tool_start`, and `subagent_tool_end` event types by routing them to a dedicated subagent store keyed by namespace, not to `streamingMsgIdRef.current`.

#### Scenario: Subagent message routed to subagent store
- **WHEN** a `subagent_message` event is received
- **THEN** the event is routed to the subagent store for its namespace, not to the orchestrator's assistant bubble

#### Scenario: Subagent reasoning routed to subagent store
- **WHEN** a `subagent_reasoning` event is received
- **THEN** the event is routed to the subagent store for its namespace, not to the orchestrator's assistant bubble

#### Scenario: Subagent tool start routed to subagent store
- **WHEN** a `subagent_tool_start` event is received
- **THEN** the event is routed to the subagent store for its namespace, not to the orchestrator's assistant bubble

#### Scenario: Subagent tool end routed to subagent store
- **WHEN** a `subagent_tool_end` event is received
- **THEN** the event is routed to the subagent store for its namespace, not to the orchestrator's assistant bubble

### Requirement: SUBAGENTS panel SHALL be registered in PANELS
`PANELS` in `src/tui/panels.js` SHALL include a `SUBAGENTS` entry, and `getPanelOrder()` SHALL include it in the tab navigation order.

#### Scenario: PANELS includes SUBAGENTS
- **WHEN** `PANELS` is inspected
- **THEN** it includes a `SUBAGENTS` entry

#### Scenario: getPanelOrder includes SUBAGENTS
- **WHEN** `getPanelOrder()` is called
- **THEN** the returned order array includes `PANELS.SUBAGENTS`

### Requirement: SUBAGENTS panel SHALL render subagent activity

`src/tui/subagentsPanel.js` SHALL render each subagent's reasoning/message segments and tool calls, keyed by namespace.

#### Scenario: Panel renders subagent message segments

- **WHEN** the SUBAGENTS panel is rendered with a subagent store containing a subagent's message segments
- **THEN** the panel renders the subagent's message content

#### Scenario: Panel renders subagent reasoning segments

- **WHEN** the SUBAGENTS panel is rendered with a subagent store containing a subagent's reasoning segments
- **THEN** the panel renders the subagent's reasoning content

#### Scenario: Panel renders subagent tool calls

- **WHEN** the SUBAGENTS panel is rendered with a subagent store containing a subagent's tool calls
- **THEN** the panel renders the subagent's tool call activity

### Requirement: App SHALL render the SUBAGENTS panel
The App render switch in `src/tui/app.js` SHALL include a `currentView === PANELS.SUBAGENTS` branch that renders the subagents panel, passing the subagent store.

#### Scenario: App renders SUBAGENTS panel
- **WHEN** `currentView === PANELS.SUBAGENTS`
- **THEN** the App renders the subagents panel component

### Requirement: SUBAGENTS panel SHALL scroll via arrow and page keys

When the SUBAGENTS panel is the active view, the up/down arrow keys and PageUp/PageDown keys SHALL scroll the panel's virtualized list in the chosen direction. Up/PageUp scroll toward the top; Down/PageDown scroll toward the bottom. Line keys scroll by one line; page keys scroll by the viewport height.

#### Scenario: Up arrow scrolls up

- **WHEN** the SUBAGENTS panel is the active view and the user presses the up arrow key
- **THEN** the panel scrolls up by one line

#### Scenario: Down arrow scrolls down

- **WHEN** the SUBAGENTS panel is the active view and the user presses the down arrow key
- **THEN** the panel scrolls down by one line

#### Scenario: PageUp scrolls up by a page

- **WHEN** the SUBAGENTS panel is the active view and the user presses PageUp
- **THEN** the panel scrolls up by the viewport height

#### Scenario: PageDown scrolls down by a page

- **WHEN** the SUBAGENTS panel is the active view and the user presses PageDown
- **THEN** the panel scrolls down by the viewport height

#### Scenario: Manual scroll-up suppresses auto-scroll

- **WHEN** the user scrolls away from the bottom of the panel
- **THEN** auto-scroll to the bottom is suppressed until the user returns to the bottom
