## Why

When the LLM provider returns a 400 `ContextWindowExceededError` (litellm), the app fails to connect instead of recovering. The `wrapModelCall` error handler in `src/provider/tokenBudgetMiddleware.js` only detects 429 rate-limit errors; a 400 context-window error falls through `throw err` and surfaces to the user as a connection failure. The default `maxTokens` of `4096` also caps output tokens unnecessarily.

## What Changes

- Detect a 400 `ContextWindowExceededError` in the innermost middleware and trigger compaction via the existing `agent.compactContext` path, then re-send the request once.
- Change the default `maxTokens` from `4096` to `-1` (unlimited / no cap) in `src/config/schemas/providers.js` and `config.yaml`.
- Omit `maxTokens` from the `ChatOpenAI` opts when it is `-1` in `src/provider/openai.js`, so the model uses its own output-token default.
- Normalize `-1` → `0` in the context estimators (`src/tui/conversationArea.js` and `src/provider/tokenBudgetMiddleware.js`) so the estimate is not off by one.
- Add unit tests for the `-1` default/normalization and the 400-triggers-compaction-and-retry path.

## Capabilities

### New Capabilities
<!-- None introduced -->

### Modified Capabilities
- `context-compaction`: The system SHALL detect a 400 `ContextWindowExceededError`, compact the context via the existing compaction path, and re-send the request once. If the retry also fails with a context-window error, the error SHALL surface to the user.
- `context-estimation`: The context-cost helper SHALL treat a `maxTokens` of `-1` as `0` (no output budget) so the estimate is not off by one.
- `config-system`: The `maxTokens` provider config SHALL allow `-1` (unlimited) and default to `-1`.

## Impact

- `src/config/schemas/providers.js` — `maxTokens` schema allows `-1` and defaults to `-1`.
- `config.yaml` — `maxTokens: 4096` → `-1`.
- `src/provider/openai.js` — `createChatModel` omits `maxTokens` when `-1`.
- `src/provider/tokenBudgetMiddleware.js` — `estimateContextCost` normalizes `-1` → `0`; `wrapModelCall` detects 400 context-window errors and triggers compaction + retry.
- `src/tui/conversationArea.js` — `maxTokens` normalized `-1` → `0`.
- `src/agent/deepAgents.js` — wires the compaction callback into the middleware options.
- `tests/unit/provider/` — new tests for `-1` handling and the 400-compaction-retry path.

## Non-goals

- Not changing the summarization/trim strategy itself (reuses the existing `compactAgentContext` path).
- Not adding multi-iteration compaction beyond a single retry on a 400.
- Not changing the 429 rate-limit handling.
