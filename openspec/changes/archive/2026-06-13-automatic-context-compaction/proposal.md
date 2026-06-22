## Why

When the LLM returns a 400 error indicating the conversation has exceeded the model's maximum context length, the user's request fails with no recovery. This is especially problematic during long conversations where the accumulated context (system prompt + memory entries + conversation history) can easily exceed model limits. Currently, the user must start a new session to continue — losing all context and conversation history.

## What Changes

- **New `compactContext` tool**: A LangChain tool that rewrites the conversation history to fit within a token budget, preserving high-fidelity information through a tiered retention strategy
- **Automatic error detection**: `callReactAgent` detects 400 errors containing "maximum context length" and triggers compaction
- **Automatic retry loop**: After compaction, the system retries the LLM call with the compacted context. If the error persists, it compacts again progressively until success or a minimum threshold
- **Config-driven token budget**: The available token budget is calculated as `maxContextLength - maxTokens` where maxTokens comes from `config.providers.<name>.maxTokens`

## Capabilities

### New Capabilities
- `context-compaction`: Automatic conversation context compaction when LLM returns context length errors. Includes a `compactContext` tool and retry logic in the agent invocation path.

### Modified Capabilities
<!-- None — no existing spec-level requirements are changing -->

## Impact

- **Affected code**:
  - `src/agent/react.js` — `callReactAgent` and `callReactAgentStreaming` error handling
  - `src/tools/compactContext.js` — new file for the compaction tool
  - `src/tools/index.js` — registration of the new tool
  - `src/config/loader.js` — read access for `maxTokens` value
- **Dependencies**: None new — uses existing LangGraph checkpointer for conversation access
- **Breaking changes**: None
