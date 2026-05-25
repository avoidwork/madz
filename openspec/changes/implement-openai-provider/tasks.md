## 1. Dependencies

- [x] 1.1 Add `@langchain/langgraph` and `@langchain/openai` to `package.json` via `npm install` (no `langchain` package needed — `createReactAgent` is from `@langchain/langgraph/prebuilt`)

## 2. Provider module — model client factory

- [x] 2.1 Create `src/provider/openai.js` with JSDoc comments on all public functions

## 3. Provider implementation

- [x] 3.1 Implement `createChatModel(config)` in `src/provider/openai.js` that returns a `ChatOpenAI` instance with `model`, `temperature`, `maxTokens`, `openAIApiKey`, and `configuration.baseURL` from provider config
- [x] 3.2 `createChatModel` must NOT import from `@langchain/langgraph` or `langchain` — it only imports `ChatOpenAI` from `@langchain/openai`

## 4. Agent module — ReAct graph

- [x] 4.1 Create `src/agent/react.js` with JSDoc comments on all public functions

- [x] 4.2 Implement `createReactAgent(model, tools = [])` that imports `createReactAgent` from `@langchain/langgraph/prebuilt` and returns a compiled agent with the given model and tool list

- [x] 4.3 Implement `callReactAgent(agent, message)` that wraps `agent.invoke({ messages: [{ role: "user", content: message }] })`, extracts the final text content, and returns `{ content: string }`
- [x] 4.4 `callReactAgent` must re-throw any error from `agent.invoke` without modification

## 5. Wire into index.js

- [x] 5.1 In `index.js`, import `createChatModel` from `src/provider/openai.js` and `callReactAgent` from `src/agent/react.js`

- [x] 5.2 Replace the stub `callProvider` function (lines 79-86) with a composed implementation:
  ```javascript
  async function callProvider(name, providerConfig, message) {
    const model = createChatModel(providerConfig);
    const agent = createReactAgent(model, []);
    const result = await callReactAgent(agent, message);
    return { provider: name, content: result.content, tokens: { input: 0, output: 0 } };
  }
  ```

- [x] 5.3 Update `dispatchProvider` (line 66) to pass `config.providers[name]` instead of an empty object `{}`

## 6. Config updates

- [x] 6.1 Update `config.yaml` to add an optional top-level `inference` section with `temperature: 0.7` and `maxTokens: 4096` as fallback defaults for provider-level values

## 7. Tests

- [x] 7.1 Create `tests/unit/provider.test.js` with tests for `createChatModel`:
  - Verifies config values are passed to `ChatOpenAI` constructor
  - Verifies `base_url` maps to `configuration.baseURL`
  - Verifies `credentials.apiKey` maps to `openAIApiKey`

- [x] 7.2 Create `tests/unit/react_agent.test.js` with tests for `callReactAgent`:
  - Verifies correct message format `{ role: "user", content }` is passed to agent
  - Verifies returned `{ content }` structure
  - Verifies errors from `agent.invoke` re-throw without modification

- [x] 7.3 Mock `@langchain/langgraph/prebuilt` and `@langchain/openai` in tests using module replacement

## 8. Verify

- [x] 8.1 Run `npm run lint` (oxlint + oxfmt) and ensure zero errors

- [x] 8.3 Run `npm run test` and ensure all tests pass

- [x] 8.4 Run `npm run coverage` and ensure 100% coverage on changed files
