## ADDED Requirements

### Requirement: Agent accepts an optional checkpointer parameter
The `createReactAgent` function at `src/agent/react.js` SHALL accept an optional third parameter `checkpointer` of type `BaseCheckpointSaver | null`. When provided, it SHALL be passed to `createReactAgentGraph` from `@langchain/langgraph/prebuilt` as the `checkpointer` option during compilation.

#### Scenario: Agent with checkpointer compiles successfully
- **WHEN** `createReactAgent(model, tools, checkpointer)` is called with a valid `InMemorySaver`
- **THEN** the function calls `createReactAgentGraph({ llm: model, tools, checkpointer })`
- **THEN** the returned agent supports thread-based conversation memory

#### Scenario: Agent without checkpointer is backward compatible
- **WHEN** `createReactAgent(model, tools)` is called with only two arguments
- **THEN** the function calls `createReactAgentGraph({ llm: model, tools })` with no checkpointer
- **THEN** the returned agent behaves identically to the current stateless version

### Requirement: Agent invocation accepts optional config with thread_id
The `callReactAgent` function SHALL accept an optional `config` parameter as the third positional argument. When provided, it MUST be passed through to the agent's `.invoke()` or `.streamEvents()` call. The config MUST support `configurable.thread_id` for thread-based conversation resumption.

#### Scenario: Non-streaming invocation with thread_id
- **WHEN** `callReactAgent(agent, message, { configurable: { thread_id: "abc" } }, systemPrompt)` is called
- **THEN** the agent is invoked as `agent.invoke({ messages: initMessages, configurable: { thread_id: "abc" } })`
- **THEN** the checkpointer saves and loads state for thread "abc" across invocations

#### Scenario: Streaming invocation with thread_id
- **WHEN** `callReactAgent(agent, message, { configurable: { thread_id: "abc" } }, systemPrompt, callback)` is called
- **THEN** the agent streams events as `agent.streamEvents({ messages: initMessages }, { version: "v3", configurable: { thread_id: "abc" } })`
- **THEN** the streaming output is written to the same checkpoint thread

#### Scenario: Invocation without config is backward compatible
- **WHEN** `callReactAgent(agent, message, systemPrompt)` is called with no config argument
- **THEN** the agent is invoked as `agent.invoke({ messages: initMessages })` with no additional config
- **THEN** the checkpointer (if present) auto-creates a new thread for this invocation

### Requirement: Agent error propagation is preserved
All errors from the LangGraph agent invocation (including checkpointer errors, thread-not-found errors, etc.) SHALL propagate to the caller without modification.

#### Scenario: Checkpointer persistence error propagates
- **WHEN** the checkpointer throws during checkpoint save (e.g., SQLite disk full)
- **THEN** `callReactAgent` re-throws the error without wrapping or catching
