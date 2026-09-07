## ADDED Requirements

### Requirement: Turn boundary detection
The system SHALL detect turn boundaries in the agent's event stream by monitoring `values`/`updates` channel for new `HumanMessage` entries and `tools` channel for tool call lifecycle events.

#### Scenario: HumanMessage triggers turn:start
- **WHEN** a new `HumanMessage` appears in the `values`/`updates` channel
- **THEN** the transformer SHALL emit a `{ type: "turn:start" }` event on the `turns` channel

#### Scenario: Tool call tracking
- **WHEN** a `tool-started` event appears on the `tools` channel
- **THEN** the transformer SHALL increment the pending tool call counter
- **WHEN** a `tool-finished` event appears on the `tools` channel
- **THEN** the transformer SHALL decrement the pending tool call counter

#### Scenario: AIMessage with content triggers turn:end
- **WHEN** the last message in state is an `AIMessage` with non-empty content AND there are no pending tool calls
- **THEN** the transformer SHALL emit a `{ type: "turn:end" }` event on the `turns` channel

#### Scenario: Turn events are ordered correctly
- **WHEN** a complete user-message-to-AI-response cycle occurs
- **THEN** the `turns` channel SHALL yield events in order: `turn:start`, `turn:end`

#### Scenario: Multiple turns in a single run
- **WHEN** multiple user messages are processed in a single run
- **THEN** the `turns` channel SHALL yield alternating `turn:start`/`turn:end` pairs for each turn

### Requirement: Transformer registration
The system SHALL allow consumers to register the turn transformer via `streamTransformers` in `createDeepAgent()` or at call-site via `streamEvents(..., { transformers: [...] })`.

#### Scenario: Registration via createDeepAgent
- **WHEN** a consumer passes `streamTransformers: [() => createTurnTransformer()]` to `createDeepAgent()`
- **THEN** the transformer SHALL be active for all `streamEvents()` calls on that agent

#### Scenario: Registration via streamEvents
- **WHEN** a consumer passes `transformers: [() => createTurnTransformer()]` to `streamEvents()`
- **THEN** the transformer SHALL be active for that specific invocation

### Requirement: Type exports
The system SHALL export `createTurnTransformer` function and `TurnEvent` type from the deepagents package.

#### Scenario: TypeScript type inference
- **WHEN** a consumer imports `createTurnTransformer` and `TurnEvent` from `deepagents`
- **THEN** the types SHALL be available and `run.extensions.turns` SHALL be typed as `AsyncIterable<TurnEvent>`

### Requirement: Edge case handling
The system SHALL handle edge cases gracefully.

#### Scenario: Empty user message
- **WHEN** a `HumanMessage` with empty content enters state
- **THEN** the transformer SHALL still emit `turn:start`

#### Scenario: Agent with zero tool calls
- **WHEN** the agent responds directly without any tool calls
- **THEN** the transformer SHALL emit `turn:start` followed by `turn:end` when the `AIMessage` appears

#### Scenario: Nested subagent delegations
- **WHEN** tool calls from subagents appear on different namespaces
- **THEN** the transformer SHALL track tool calls across all namespaces
