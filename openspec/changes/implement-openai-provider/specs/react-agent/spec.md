## ADDED Requirements

### Requirement: Agent creates a LangGraph-based ReAct agent
The system SHALL provide a ReAct agent at `src/agent/react.js` with an exported `createReactAgent` function. Given a `ChatLanguageModel` instance and an optional tool list, the function SHALL build a LangGraph-based ReAct agent using `createReactAgent` from the `langchain` package. The agent SHALL be invokable with `{ messages: [{ role, content }] }` and return an agent result containing model output.

#### Scenario: Agent accepts a model and empty tool list
- **WHEN** `createReactAgent` is called with a `ChatOpenAI` model and an empty array `[]`
- **THEN** the agent delegates to the LLM without any tool invocation steps
- **THEN** the agent returns an invoke result containing the LLM's text response

#### Scenario: Agent accepts a model with bound tools
- **WHEN** `createReactAgent` is called with a model and a non-empty tool array
- **THEN** the agent MAY invoke tools during the ReAct reasoning loop
- **THEN** the agent returns the final user-facing response after tool-use reasoning

### Requirement: Agent invocation returns structured result
The system SHALL provide a `callReactAgent(agent, message)` helper at `src/agent/react.js` that wraps `createReactAgent` invocation with message formatting and result extraction. It SHALL accept a string prompt and return `{ content: string }` with the agent's final response text.

#### Scenario: Agent invocation with user message
- **WHEN** `callReactAgent` is called with a ReAct agent and a user message string
- **THEN** the function constructs `{ messages: [{ role: "user", content: message }] }`
- **THEN** it invokes the agent and extracts the last text-only message from the result
- **THEN** it returns `{ content: <text> }`

#### Scenario: Agent invocation with invalid message
- **WHEN** `callReactAgent` is called with a ReAct agent and an empty string
- **THEN** the function still constructs a valid message payload and invokes the agent
- **THEN** any model-side validation error is re-thrown to the caller

### Requirement: Agent error propagation
The system SHALL propagate all errors from the LangGraph agent invocation to the caller. No errors are caught, wrapped, or defaulted within the agent module.

#### Scenario: Network error propagates to caller
- **WHEN** the ReAct agent throws during invocation (e.g., network failure)
- **THEN** `callReactAgent` re-throws the original error without modification
- **THEN** the error bubbles up to `dispatchProvider` for fallback handling

#### Scenario: Auth error propagates to caller
- **WHEN** the LLM returns a 401 or 403 response
- **THEN** the agent's underlying error is re-thrown to the caller
- **THEN** `dispatchProvider` catches and iterates to the next provider
