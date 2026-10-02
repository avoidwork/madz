## Context

The `TokenBudget` middleware (`src/provider/tokenBudgetMiddleware.js`) is the innermost middleware in the deepagents chain. Its `wrapModelCall` error handler only recognizes 429 rate-limit errors via `isRateLimitError`; any other error — including a 400 `ContextWindowExceededError` from litellm — falls through `throw err` and surfaces to the user as a connection failure. Separately, the provider config schema hard-codes `maxTokens` to a positive integer defaulting to `4096`, which caps output tokens and is incompatible with the `-1` (unlimited) convention.

The existing compaction path is `compactAgentContext()` in `src/agent/deepAgents.js`, exposed on the agent as `agent.compactContext` (line 454). It performs summarization + trim and is already wired for the TUI's manual compaction. This change reuses that path rather than building a new one.

## Goals / Non-Goals

**Goals:**
- Detect a 400 `ContextWindowExceededError` in the innermost middleware, compact the context via `agent.compactContext`, and re-send the request once.
- Allow `-1` as the default `maxTokens` (unlimited / no cap) and propagate it correctly through the model client and context estimators.
- Add unit tests for the `-1` handling and the 400-compaction-retry path.

**Non-Goals:**
- Changing the summarization/trim strategy itself.
- Multi-iteration compaction beyond a single retry on a 400.
- Altering the 429 rate-limit handling.

## Decisions

### Decision 1: Detect the 400 in `TokenBudget.wrapModelCall` and trigger compaction via a callback
The middleware is innermost, so it observes the final post-summarization/post-truncation message set — the exact request that would exceed the context window. Rather than importing the agent (a circular dependency risk), the middleware accepts an optional `onContextWindowExceeded` callback. `deepAgents.js` passes a callback that invokes `agent.compactContext` with the current runnable config and session state. On a 400 context-window error, the middleware:
1. Releases the budget reservation.
2. Calls `onContextWindowExceeded(request)` to compact.
3. Re-estimates the cost and re-dispatches the handler once.
4. If the retry also fails with a context-window error, surfaces the error.

**Alternatives considered:**
- *Importing the agent directly* — rejected due to circular dependency risk and coupling.
- *A separate middleware registered in the chain* — rejected because the token-budget middleware is already innermost and has the request in scope; a separate middleware would need to duplicate the request/retry logic.

### Decision 2: Detect context-window errors by status 400 + message heuristic
A 400 alone is too broad (invalid API key is also 400). The detector checks `err.status === 400` (or `err.response?.status === 400`) AND the message matches a context-window pattern (e.g. `/context|context length|context window|maximum.*length/i`). This mirrors the existing `context-compaction` spec's regex approach while staying conservative.

### Decision 3: Normalize `-1` → `0` in context estimators
`estimateContextCost` and the TUI counter both use `(maxTokens || 0)`. Since `-1` is truthy, it would subtract 1 from the estimate. A shared `normalizeMaxTokens()` helper (or inline `maxTokens === -1 ? 0 : maxTokens`) treats `-1` as `0` (no output budget).

### Decision 4: Omit `maxTokens` from `ChatOpenAI` opts when `-1`
`ChatOpenAI` rejects `-1` as an invalid `maxTokens`. When `config.maxTokens === -1`, `createChatModel` omits the `maxTokens` key so the model uses its own output-token default.

## Risks / Trade-offs

- **[Compaction may not reduce enough]** → The retry is attempted once; if it still fails with a context-window error, the error surfaces to the user (consistent with the existing `context-compaction` spec's "maximum iterations reached" behavior).
- **[400 false positives]** → The detector requires both status 400 and a context-window message pattern, so non-context 400s (e.g. invalid key) are not compacted.
- **[`-1` in config.yaml is a behavioral default change]** → Existing users who relied on the `4096` cap will now get unlimited output; this is the intended fix per the issue.
