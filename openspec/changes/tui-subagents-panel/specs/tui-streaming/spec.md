## MODIFIED Requirements

### Requirement: Streaming handler SHALL route subagent events to a subagent store
The `createStreamingHandler` function SHALL handle `subagent_message`, `subagent_reasoning`, `subagent_tool_start`, and `subagent_tool_end` event types by routing them to a dedicated subagent store keyed by namespace, instead of updating `streamingMsgIdRef.current`. The orchestrator's assistant bubble SHALL continue to receive the existing `message`, `reasoning`, `on_tool_start`, `on_tool_end`, `tool`, and `on_tool_error` event types.

#### Scenario: Subagent message routed to subagent store
- **WHEN** a `subagent_message` event is received with a namespace
- **THEN** the event is routed to the subagent store for that namespace, not to `streamingMsgIdRef.current`

#### Scenario: Subagent reasoning routed to subagent store
- **WHEN** a `subagent_reasoning` event is received with a namespace
- **THEN** the event is routed to the subagent store for that namespace, not to `streamingMsgIdRef.current`

#### Scenario: Subagent tool start routed to subagent store
- **WHEN** a `subagent_tool_start` event is received with a namespace
- **THEN** the event is routed to the subagent store for that namespace, not to `streamingMsgIdRef.current`

#### Scenario: Subagent tool end routed to subagent store
- **WHEN** a `subagent_tool_end` event is received with a namespace
- **THEN** the event is routed to the subagent store for that namespace, not to `streamingMsgIdRef.current`

#### Scenario: Root graph events continue to update assistant bubble
- **WHEN** a `message` or `reasoning` event is received without a subagent namespace
- **THEN** the event continues to update `streamingMsgIdRef.current`
