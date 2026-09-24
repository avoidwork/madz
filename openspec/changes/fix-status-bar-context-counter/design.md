## Context

The TUI status bar's `[▤ N]` context counter is produced by `updateContextSize` in `src/tui/conversationArea.js`. It currently computes:

```
totalTokens = calculateConversationTokens(conversation, model, encoding)
           + calculateConversationTokens([{ role: "system", content: loadSystemPrompt() }], model, encoding)
```

This undercounts the orchestrator's actual context window in two ways:

1. **AGENTS.md is omitted.** `createDeepAgentsOrchestrator` (`src/agent/deepAgents.js`) appends the project's `AGENTS.md` to the system prompt with `systemPrompt + "\n\n---\n\n" + agentsContent`. The TUI counter never includes it.
2. **The output token budget is omitted.** The token-budget middleware's `estimateCost` computes `inputTokens + (options.maxTokens || 0)`. The TUI counter never adds `maxTokens`.

Additionally, the middleware's cost logic is nested inside `createTokenBudgetMiddleware` and only reachable when `maxTokensMinute > 0` (the factory returns `null` otherwise), so the TUI cannot reuse it.

## Goals / Non-Goals

**Goals:**
- Extract the context-cost logic into an exported `estimateContextCost` helper in `src/provider/tokenBudgetMiddleware.js`, callable regardless of whether the budget is enabled.
- Make `updateContextSize` build the full system prompt (SYSTEM_PROMPT + AGENTS.md) the same way `createDeepAgentsOrchestrator` does.
- Include the output token budget (`maxTokens`) in the context count.
- Add tests for the helper and for `updateContextSize`.

**Non-Goals:**
- Do NOT touch the `[💎 A/B]` jewel display in the status bar.
- Do NOT change token-budget enforcement semantics, the no-op path, or budget sharing.
- Do NOT change `loadSystemPrompt` itself (it intentionally does not append AGENTS.md).

## Decisions

### Decision 1: Export `estimateContextCost` from the middleware module

The middleware's `estimateCost` is a closure over `options` (model, encoding, maxTokens). Extract the body into an exported async function:

```js
export async function estimateContextCost(conversation, { model, encoding, maxTokens } = {}) {
	const inputTokens = await calculateConversationTokens(conversation, model, encoding);
	return inputTokens + (maxTokens || 0);
}
```

The middleware's internal `estimateCost` delegates to it, so enforcement behavior is unchanged. The helper is callable from the TUI regardless of `maxTokensMinute`.

**Alternatives considered:**
- Exporting the whole middleware factory — rejected, because it returns `null` when the budget is disabled and couples the TUI to enforcement.
- Duplicating the logic in the TUI — rejected, because it risks drift between the two cost estimates.

### Decision 2: Build the full system prompt in `updateContextSize`

Mirror `createDeepAgentsOrchestrator`: after `loadSystemPrompt()`, read `AGENTS.md` from `config.cwd` and append it with `"\n\n---\n\n"`. Use the same separator so the count matches what the orchestrator sends. Gracefully skip AGENTS.md if it cannot be read (log debug), matching the orchestrator's `try/catch`.

### Decision 3: Include `maxTokens` in the count

Read `providerConfig.maxTokens` (default 0) and add it to the total, matching the middleware's `estimateCost` semantics.

## Risks / Trade-offs

- **[AGENTS.md is large]** → The counter will grow; this is the intended, accurate behavior. The count is a display estimate, not a hard limit.
- **[AGENTS.md missing]** → The `try/catch` skips it and logs debug, so the counter degrades gracefully to the previous behavior.
- **[Test isolation]** → `updateContextSize` is a React hook callback that reads from disk (`loadSystemPrompt`, `AGENTS.md`). Tests must mock `loadSystemPrompt` and the filesystem, or test the extracted helper directly.
