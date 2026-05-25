## Context

The `callProvider` function in `index.js` is a stub returning `[No provider implementation: ...]`. Config loading, validation, and fallback routing for LLM providers are fully implemented in `src/config/loader.js` and `src/config/schemas.js`. The `config.yaml` defines provider configs with `base_url`, `model`, `credentials.apiKey`, `temperature`, `maxTokens`, and `rateLimit`. The `dispatchProvider` function already iterates a `fallback_order` chain. What's missing is the actual LLM API call.

## Goals / Non-Goals

**Goals:**
- Create `src/provider/openai.js` — a thin model client factory that produces `ChatOpenAI` instances from provider config
- Create `src/agent/react.js` — a LangGraph-based ReAct agent that composes with any `ChatLanguageModel`
- Wire the composition in `index.js` `callProvider` so `dispatchProvider` returns real LLM responses
- Support both `openai` (api.openai.com) and `local` (Ollama at localhost:11434) via the same abstractions
- Graceful error handling: errors propagate to `dispatchProvider` for fallback chain iteration

**Non-Goals:**
- Streaming support (out of scope for initial implementation)
- Multi-turn conversation within a single `callProvider` call (single prompt/response per call)
- Tool use / function calling from the LLM (no tools bound in MVP; the agent accepts an empty tool list)
- LangGraph persistence/checkpointing (not needed for single-call dispatch)
- Provider model registry or multi-model selection within a provider

## Decisions

### Decision 1: Provider is a model factory, not an agent

`src/provider/openai.js` exports `createChatModel(config)` which returns a `ChatOpenAI` instance. The provider does NOT contain graph or agent logic — it is a thin, pure client factory that transforms provider config into a ready-to-use model instance.

Rationale: Separation of concerns. The provider's responsibility is connecting to the LLM API. The agent's responsibility is orchestration (planning, reasoning, tool use). They compose cleanly, and the agent works with any `ChatLanguageModel`, not just OpenAI.

### Decision 2: Agent lives in `src/agent/react.js`

`src/agent/react.js` exports `createReactAgent(model, tools = [])` which builds a ReAct agent using `createReactAgent` from `@langchain/langgraph/prebuilt`. The agent is a LangGraph-based orchestrator that takes a model and a tool list as constructor parameters.

Rationale: `@langchain/langgraph/prebuilt` exports `createReactAgent` directly — no need for the full `langchain` package. Keeping the agent in its own module means the provider stays thin and the agent is reusable across different model types and tool sets.

### Decision 3: Composition wiring in `index.js`

`callProvider` in `index.js` becomes the composition point:
```javascript
import { createChatModel } from "./src/provider/openai.js";
import { createReactAgent } from "./src/agent/react.js";

async function callProvider(name, providerConfig, message) {
  const model = createChatModel(providerConfig);
  const agent = createReactAgent(model, []);  // empty tools in MVP
  const result = await agent.invoke({
    messages: [{ role: "user", content: message }]
  });
  return { provider: name, content: result.content, tokens: { input: 0, output: 0 } };
}
```

### Decision 4: No retries in the agent or provider — `dispatchProvider` handles fallback

Network errors, auth failures, and rate limits propagate up to `dispatchProvider` which catches and tries the next provider. No retry logic in either the provider or the agent.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `@langchain/langgraph` adds non-trivial deps (`langgraph-checkpoint`, `langgraph-sdk`) | Both are single-purpose modules; only `@langchain/langgraph/prebuilt` path is used at runtime |
| `ChatOpenAI` may not support all Ollama features | Ollama's `/v1/chat/completions` endpoint is OpenAI-compatible; basic chat works |
| No streaming means slower TUI response feel | Documented as v1 limitation; streaming is a follow-up task |
| Blanket `catch` in `dispatchProvider` could mask bugs | Each error logs the provider name and message (existing code); real bugs surface in error output |
| Two new modules add complexity vs monolithic provider | Separation of concerns enables reuse; agent can work with non-OpenAI models later |

## Migration Plan

1. Add dependencies: `npm install @langchain/langgraph @langchain/openai` (**Note**: `langchain` package NOT needed)
2. Create `src/provider/openai.js` — model client factory with `createChatModel`
3. Create `src/agent/react.js` — ReAct agent with `createReactAgent` and `callAgent`
4. Update `index.js`: compose provider → agent in `callProvider`
5. Update `config.yaml`: add `inference` fallback section for temperature/maxTokens
6. Update `config-system` spec requirement to reference resolved provider config usage
7. Add `openai-provider` spec for model client contract
8. Add `react-agent` spec for agent graph contract
9. Write tests: unit tests for both provider and agent with mocked modules
10. Run pre-commit: `oxlint`, `oxfmt`, `tsc --noEmit`, `npm run test`, coverage check

## Open Questions

1. Should the agent accept a model via parameter or should it use the provider factory internally? (Chose factory — agent takes a model parameter for testability)
2. Do we want structured logging for LLM calls via the existing telemetry subsystem?
3. Should the provider config schema enforce `type: "openai"` or allow `"openai-compat"` as an alias for Ollama/local models?
