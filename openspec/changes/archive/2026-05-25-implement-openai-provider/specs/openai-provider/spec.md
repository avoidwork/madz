## ADDED Requirements

### Requirement: Provider creates a ChatOpenAI model client
The system SHALL provide a model client factory at `src/provider/openai.js` with an exported `createChatModel` function. Given a provider config object containing `base_url`, `model`, `credentials.apiKey`, `temperature`, and `maxTokens`, the function SHALL return a configured `ChatOpenAI` instance ready for use by an agent. The provider exports no graph, no agent, and no orchestration logic — it is a pure client factory.

#### Scenario: Provider creates a configured ChatOpenAI instance
- **WHEN** `createChatModel` is called with `{ base_url: "https://api.openai.com/v1", model: "gpt-4o", credentials: { apiKey: "sk-..." }, temperature: 0.7, maxTokens: 4096 }`
- **THEN** the function returns a `ChatOpenAI` instance with `baseURL: "https://api.openai.com/v1"`, `model: "gpt-4o"`, `openAIApiKey: "sk-..."`, `temperature: 0.7`, `maxTokens: 4096`

#### Scenario: Provider creates a ChatOpenAI for local Ollama
- **WHEN** `createChatModel` is called with `{ base_url: "http://localhost:11434/v1", model: "llama3.1", credentials: { apiKey: "local-model" }, temperature: 0.7, maxTokens: 4096 }`
- **THEN** the function returns a `ChatOpenAI` instance with `baseURL: "http://localhost:11434/v1"`, `model: "llama3.1"`, and the local API key

#### Scenario: Provider does not depend on LangGraph
- **WHEN** `src/provider/openai.js` is imported
- **THEN** it does NOT import `@langchain/langgraph` or `langchain` graph primitives
- **THEN** it only imports `ChatOpenAI` from `@langchain/openai`

#### Scenario: Provider config values are applied to model constructor
- **WHEN** `createChatModel` is called with a provider config
- **THEN** `base_url` is mapped to the `ChatOpenAI` constructor's `configuration.baseURL`
- **THEN** `model` is mapped to the constructor's `model` option
- **THEN** `credentials.apiKey` is mapped to the constructor's `openAIApiKey` option
- **THEN** `temperature` and `maxTokens` are passed as constructor options
