## ADDED Requirements

### Requirement: Streaming responses return aggregated AI text
The `callReactAgentStreaming` function SHALL return `{ content: aggregatedText }` where `aggregatedText` is the concatenated text from all `on_chat_model_stream` events containing `AIMessageChunk` instances. When no text events occur, it SHALL fall back to `{ content: originalMessage }`.

#### Scenario: Successful stream returns aggregated text
- **WHEN** `callReactAgentStreaming` processes stream events with AIMessageChunk instances containing "Hello" and " World"
- **THEN** the function returns `{ content: "Hello World" }`

#### Scenario: Empty stream falls back to original message
- **WHEN** `callReactAgentStreaming` processes zero stream events
- **THEN** the function returns `{ content: originalMessage }`

#### Scenario: Recursion limit error returns original message immediately
- **WHEN** the agent throws a GraphRecursionError
- **THEN** the function returns `{ content: originalMessage }` without waiting for stream completion

### Requirement: Message type detection handles all message types
The `getMessageRole` function SHALL map LangChain message instances to their corresponding conversation role strings: HumanMessage/HumanMessageChunk → "user", AIMessage/AIMessageChunk → "assistant", ToolMessage → "tool", SystemMessage → "system". Unknown message types SHALL fall back to "system".

#### Scenario: HumanMessage maps to user
- **WHEN** `getMessageRole(new HumanMessage("hi"))` is called
- **THEN** it returns "user"

#### Scenario: AIMessage maps to assistant
- **WHEN** `getMessageRole(new AIMessage("hello"))` is called
- **THEN** it returns "assistant"

#### Scenario: ToolMessage maps to tool
- **WHEN** `getMessageRole(new ToolMessage({ content: "result", tool_call_id: "tc1" }))` is called
- **THEN** it returns "tool"

#### Scenario: Chunk variants are handled
- **WHEN** `getMessageRole(new HumanMessageChunk("hi"))` or `getMessageRole(new AIMessageChunk("hello"))` is called
- **THEN** they return "user" and "assistant" respectively

#### Scenario: Unknown types fall back to system
- **WHEN** `getMessageRole({ content: "unknown", type: "custom" })` is called
- **THEN** it returns "system"

### Requirement: Message array iteration avoids unnecessary copies
The `extractContent` function SHALL find the last AIMessage or AIMessageChunk in the messages array using a reverse for-loop without creating intermediate array copies via spread or reverse.

#### Scenario: Finds last AI message efficiently
- **WHEN** `extractContent` is called with an array containing multiple messages including AIMessage instances
- **THEN** it returns the content of the last AIMessage/AIMessageChunk without spreading or reversing the array