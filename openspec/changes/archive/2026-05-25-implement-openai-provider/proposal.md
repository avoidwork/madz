## Why

The `callProvider` function in `index.js` is a stub returning `[No provider implementation: openai]`. The project has full config loading, validation, and fallback routing for LLM providers, but no actual LLM call implementation. Users cannot get real AI responses.

## What Changes

- Add `@langchain/langgraph` and `@langchain/openai` as dependencies via `npm install`. The `langchain` package is NOT needed — `createReactAgent` is exported from `@langchain/langgraph/prebuilt`.
- Create `src/provider/openai.js` — a thin LLM model client factory. Given provider config (`base_url`, `model`, `credentials.apiKey`, `temperature`, `maxTokens`), it returns a configured `ChatOpenAI` instance ready for use by an agent. **The provider is a client factory only — no graph logic.**
- Create `src/agent/react.js` — the LangGraph-based ReAct agent. It accepts a chat model (from the provider) and a tool list, builds the agent via `createReactAgent`, and runs inference. **The agent is a standalone orchestration module that composes with any compatible model.**
- Wire the graph into `index.js` `callProvider` so `dispatchProvider` creates a model via the provider, builds an agent, and invokes it for real LLM responses.
- The `local` provider (Ollama-compatible) uses the same provider interface with `base_url: http://localhost:11434/v1`.
- Update `config.yaml` with `inference` section containing `temperature` and `maxTokens` top-level keys so provider-level values have a sensible fallback.
- Add `openai-provider` spec defining provider client contract.
- Add `react-agent` spec defining agent graph contract.
- Extend `config-system` spec to require that the provider client uses resolved per-provider configuration values.

## Capabilities

### New Capabilities
- `openai-provider`: LLM model client factory that creates configured `ChatOpenAI` instances from provider config (`base_url`, `model`, `credentials.apiKey`, `temperature`, `maxTokens`). The provider is a pure client — no agent or graph logic.
- `react-agent`: LangGraph-based ReAct agent that composes with any `ChatLanguageModel` client and tool list. Accepts a prompt and returns `{ provider, content, tokens }`.

### Modified Capabilities
- `config-system`: Adds requirement that the provider client uses resolved per-provider configuration (base_url, model, credentials.apiKey, temperature, maxTokens) from `config.providers[name]` rather than empty objects.

## Impact

- **Dependencies**: Adds `@langchain/langgraph` and `@langchain/openai` to `package.json`. The full `langchain` package is NOT included.
- **Files created**: `src/provider/openai.js` (model client factory), `src/agent/react.js` (ReAct agent), `tests/unit/provider.test.js`, `tests/unit/react_agent.test.js`.
- **Files modified**: `index.js` (wire `callProvider` to compose provider → agent), `config.yaml` (add `inference` fallback section), `package.json` (new deps), `openspec/specs/openai-provider/spec.md` (new), `openspec/specs/react-agent/spec.md` (new), `openspec/specs/config-system/spec.md` (delta).
- **Breaking changes**: None — `callProvider` currently returns a stub; replacing it with a real implementation is non-breaking for existing callers.
