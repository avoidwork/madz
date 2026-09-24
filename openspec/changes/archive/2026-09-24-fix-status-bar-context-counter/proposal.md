## Why

The TUI status bar's `[▤ N]` context counter undercounts the orchestrator's actual context window. `updateContextSize` in `src/tui/conversationArea.js` counts only the conversation plus `loadSystemPrompt()` output. It omits the AGENTS.md content that `createDeepAgentsOrchestrator` appends to the system prompt, and the output token budget (`maxTokens`) that the token-budget middleware adds to its cost estimate. The counter therefore reports a smaller context window than the model actually sees.

## What Changes

- **Extract a shared estimate helper** in `src/provider/tokenBudgetMiddleware.js`: hoist the context-cost logic (conversation + system prompt + output budget) into an exported `estimateContextCost(conversation, { model, encoding, maxTokens })` function. The middleware's internal `estimateCost` delegates to it, so enforcement behavior is unchanged. The helper is callable from the TUI regardless of whether `maxTokensMinute` is configured.
- **Build the full system prompt in `updateContextSize`** (`src/tui/conversationArea.js`): after `loadSystemPrompt()`, read `AGENTS.md` from the project root (`config.cwd`) and append it with the same `"\n\n---\n\n"` separator used by `createDeepAgentsOrchestrator`. Count the combined system prompt. Gracefully skip AGENTS.md if it cannot be read.
- **Include the output budget**: add `providerConfig.maxTokens` (default 0) to the context count, matching the middleware's `estimateCost` semantics.
- **Add tests**: extend `tests/unit/provider/tokenBudgetMiddleware.test.js` for the exported helper, and add coverage for `updateContextSize` verifying AGENTS.md and `maxTokens` are included.

## Capabilities

### New Capabilities

- `context-estimation`: How the TUI context counter computes the orchestrator's context window — conversation tokens plus the full system prompt (SYSTEM_PROMPT + AGENTS.md) plus the output token budget.

### Modified Capabilities

- `context-window-status`: The status bar's `[▤ N]` context counter now reflects the full context window (conversation + system prompt + AGENTS.md + output budget) rather than just conversation + system prompt.
- `provider-token-budget`: The context-cost estimation logic is extracted into an exported `estimateContextCost` helper so it can be reused by the TUI, not just the middleware.

## Impact

- **Affected code:** `src/provider/tokenBudgetMiddleware.js`, `src/tui/conversationArea.js`, `tests/unit/provider/tokenBudgetMiddleware.test.js`, `tests/unit/tui/conversationArea.test.js`.
- **No dependency changes.** `readFile` is already available from `node:fs/promises`; `loadConfig` is already imported in the TUI path.
- **Behavior change:** the `[▤ N]` counter reports a larger, more accurate context window.

## Non-goals

- Do NOT touch the `[💎 A/B]` jewel display in the status bar.
- Do NOT change token-budget enforcement semantics, the no-op path, or budget sharing.
- Do NOT change `loadSystemPrompt` itself (it intentionally does not append AGENTS.md).
