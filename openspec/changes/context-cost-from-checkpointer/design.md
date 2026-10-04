## Context

The TUI context counter and the token-budget estimate path are fed `sessionState.getConversation()`, a simplified `{role, content}` array maintained in parallel with the LangGraph checkpointer. This array omits tool calls, reasoning content, multimodal content blocks, and tool messages that the model actually sees. As a result, the TUI context counter and the token-budget middleware under-report the true context window, leading to inaccurate budget enforcement and a counter that diverges from what the model receives.

The source of truth for the conversation is the LangGraph checkpointer state, accessible via `agent.getState(config)` → `state.values.messages`. This returns the full LangChain message array the model sees. `compactAgentContext` in `src/agent/deepAgents.js` already uses this exact pattern to read the checkpointer state.

## Goals / Non-Goals

**Goals:**
- Source context-cost estimation from the real LangGraph checkpointer session (`agent.getState(config)` → `state.values.messages`).
- Normalize LangChain messages (content blocks, tool calls, tool messages) into the `{role, content}` shape `calculateConversationTokens` expects, preserving tool-call/tool-message text.
- Expose the real session to the TUI via a `getContextMessages` accessor threaded from `index.js` through `src/tui/app.js` to `ConversationArea`.
- Fall back to `sessionState.getConversation()` when the accessor is unavailable (e.g., no checkpointer).
- Add unit and integration tests covering real LangChain message arrays.

**Non-Goals:**
- Changing how the conversation is displayed or persisted in the TUI.
- Adding new dependencies.
- Changing the token-budget enforcement semantics (only the estimation source changes).
- Refactoring `sessionState.getConversation()` itself.

## Decisions

### Decision 1: Source the conversation from the checkpointer via `agent.getState`

The conversation for token estimation SHALL be sourced from `agent.getState(config)` → `state.values.messages`, which returns the full LangChain message array the model sees. This is the source of truth.

**Alternatives considered:**
- *Enrich `sessionState.getConversation()` to capture missing fields.* Rejected because it maintains a second, parallel representation of the conversation that can diverge from the checkpointer — the source of truth is the checkpointer state.

### Decision 2: Expose a `getContextMessages` accessor to the TUI

In `index.js`, add a `getContextMessages` callback that calls `agent.getState(sessionConfig)` and returns `state.values.messages`. Thread it through the App component (`src/tui/app.js`) down to `ConversationArea` alongside the existing `compactContext`/`contextEstimate` props. The callback SHALL degrade gracefully — return `null`/`undefined` when `agent.getState` throws or no checkpointer is present.

**Alternatives considered:**
- *Thread the agent instance directly through the App props.* Rejected because it couples the TUI to the agent internals; a narrow accessor keeps the interface minimal and testable.

### Decision 3: Extend `toConversation` to normalize LangChain messages

Extend `toConversation` in `src/provider/tokenBudgetMiddleware.js` to flatten LangChain messages with content blocks, tool calls, and tool messages into the `{role, content}` shape `calculateConversationTokens` expects. This mirrors the existing `toConversationExchange` helper in `src/agent/deepAgents.js` but is more complete — it must handle `tool_calls` on assistant messages and `tool` role messages, preserving their text so the estimate is not under-counted.

**Alternatives considered:**
- *Add a separate helper.* Rejected in favor of extending the existing `toConversation` so the middleware and TUI share one normalization path.

### Decision 4: Fall back to `sessionState.getConversation()`

When the `getContextMessages` accessor is unavailable (e.g., no checkpointer, or `agent.getState` throws), `updateContextSize` and `computeContextSize` SHALL fall back to `sessionState.getConversation()`. This ensures the TUI still functions in environments without a checkpointer.

## Risks / Trade-offs

- **[Risk] `agent.getState` may throw or return no messages** → Mitigation: the accessor catches errors and returns `null`/`undefined`; the TUI falls back to `sessionState.getConversation()`.
- **[Risk] Double-counting tool-call/tool-message text** → Mitigation: `toConversation` normalizes each message exactly once; `calculateConversationTokens` tokenizes the normalized `{role, content}` array without re-processing content blocks.
- **[Risk] Divergence between the TUI counter and the middleware estimate** → Mitigation: both paths use the same `toConversation` + `estimateContextCost`/`calculateConversationTokens` helpers.
