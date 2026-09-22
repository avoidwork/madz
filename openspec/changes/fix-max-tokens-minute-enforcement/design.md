## Context

`rateLimit.maxTokensMinute` is a rolling tokens-per-minute budget enforced by a throttle wired into `createChatModel` (`src/provider/openai.js`). The throttle paces dispatch via `budget.waitForCapacity(estimate)` then `budget.consume(estimate)`. Seven compounding defects make the configured value non-binding:

1. **Broken estimate** — `calculateConversationTokens` (`src/tui/contextTokens.js`) resolves the encoder as `env || encoding || model.split(":")[0]` and passes that to `tiktoken.encoding_for_model(...)`. That API is keyed by **model** name, not encoding name. With `encoding: cl100k_base` configured it throws, is caught, and falls back to char/4. The configured tiktoken encoding is dead code.
2. **Per-instance budget** — `createTokenBudget(maxTokensMinute)` is instantiated inside `createChatModel`. `createChatModel` is called once for the orchestrator (`src/agent/deepAgents.js`) and again per custom-temperature subagent. Each owns an independent budget, so the real ceiling is `N × maxTokensMinute`.
3. **Estimate-only accounting** — `consume(estimate)` fires before dispatch; the API response `usage` is never read back, so the window paces on a guess.
4. **No concurrency guard** — `waitForCapacity` + `consume` are separate calls with no lock; concurrent dispatches can each see room and all consume, overshooting.
5. **429 retry not re-paced** — the retry path sleeps then re-calls the method directly, bypassing `waitForCapacity`.
6. **Failed requests consume budget** — `consume` happens before the try/catch, so an errored request has already charged the window.
7. **`maxConcurrency` misread** — it is a real `ChatOpenAI` field but nothing in this dispatch path uses it to gate concurrent model calls; actual concurrency comes from parallel subagents.

The dispatch path is confirmed reached on every orchestrator/subagent call (langchain `AgentNode` → `bindTools → withConfig → RunnableBinding.invoke` resolves to the monkey-patched `invoke`). The defect is in what the budget measures and how it is shared, not in whether it is invoked.

## Goals / Non-Goals

**Goals:**
- Make `maxTokensMinute` a hard, shared, usage-reconciled ceiling on tokens dispatched per rolling 60-second window.
- Fix encoder resolution so tiktoken is actually used for known models/encodings.
- Hoist a single shared budget instance so all model instances pace against one window.
- Make check-and-consume atomic so concurrent dispatches cannot overshoot.
- Reconcile the consumed entry to the API's reported usage after dispatch.
- Re-pace the 429 retry and charge the window only for the attempt that succeeds.
- Document that `maxConcurrency` does not bound what the budget sees.

**Non-Goals:**
- Changing the `maxTokensMinute` Zod schema or config surface.
- Adding new rate-limit dimensions (requests/minute, cost-based).
- Modifying `ChatOpenAI` internals or the deepagents graph.
- Changing retry policy beyond re-pacing the existing single 429 retry.

## Decisions

### Decision 1: Resolve the encoder from the model name, with an explicit encoding→model map
**Choice:** In `calculateConversationTokens`, do not pass the raw encoding name to `encoding_for_model`. Build a small `ENCODING_TO_MODEL` map (e.g. `cl100k_base → gpt-4o`, `o200k_base → gpt-4o`, `p50k_base → gpt-3.5-turbo`) so a configured encoding resolves to a model tiktoken knows. If no encoding is configured, derive the model name (strip a `:version` suffix) and pass that to `encoding_for_model`. Only fall back to char/4 when tiktoken is unavailable or the model is genuinely unknown.
**Rationale:** `encoding_for_model` is model-keyed; passing an encoding name is the root cause of the silent fallback. The map makes the configured encoding meaningful without depending on tiktoken's internal model table for every encoding.
**Alternatives considered:**
- Drop the `encoding` field entirely and always derive from model name: loses the ability for a user to pin an encoding independent of the model string.
- Use `tiktoken.get_encoding(encoding)` directly when an encoding is configured: cleaner for the explicit-encoding case, but the model-name path still needs `encoding_for_model`. We use `get_encoding` for explicit encodings and `encoding_for_model` for the model-derived path, keeping both correct.

### Decision 2: Hoist a single shared budget instance
**Choice:** Create the token budget once, at module scope in `src/provider/openai.js` (lazily, keyed by `maxTokensMinute`), and have every `createChatModel` call with `maxTokensMinute > 0` reuse that shared instance rather than constructing its own.
**Rationale:** The orchestrator and all subagents must pace against one window. A module-level singleton is the simplest way to guarantee a single instance across all `createChatModel` calls without threading the budget through `deepAgents.js`.
**Alternatives considered:**
- Thread the budget through `createDeepAgentsOrchestrator` → `createSubagentDefinitions`: more explicit but requires changing call signatures and the subagent model-creation path; the module singleton achieves the same invariant with less surface area.
- Key the singleton by `maxTokensMinute`: if two configs with different budgets coexist, the first wins. In practice a single provider config is active per process, so a single shared budget is correct; we document this.

### Decision 3: Atomic check-and-consume via a lock/queue
**Choice:** Add a `reserve(estimatedTokens)` method to the budget that atomically waits for capacity and records the consumption under a single promise-chain lock, so concurrent callers are serialized. Keep `consume`/`waitForCapacity` for backward compatibility but route the dispatch path through `reserve`.
**Rationale:** `waitForCapacity` + `consume` as two separate calls have a check-then-act race. A promise-chain lock (each reservation awaits the previous one) serializes the check-and-record so the window cannot be overshot by concurrent dispatches.
**Alternatives considered:**
- A `Set` of in-flight reservations with a re-check loop: works but is more code; the promise-chain lock is simpler and sufficient for a single-process pacer.

### Decision 4: Reconcile to actual usage after dispatch
**Choice:** After a successful dispatch, read `usage` from the response (prompt + completion tokens) and call `budget.reconcile(handle, actualTokens)` to adjust the reserved entry to the real total. The reservation returns a handle (or the dispatch tracks its own entry) so the adjustment targets the correct entry.
**Rationale:** The window should reflect real tokens, not the pre-dispatch estimate. Reconciliation corrects over/under-estimates without double-charging.
**Alternatives considered:**
- Replace the estimate with a fresh `consume(actual)`: would double-count unless the estimate entry is removed; reconciliation (adjust-in-place) is cleaner.

### Decision 5: Charge only on success; re-pace the 429 retry
**Choice:** Restructure the dispatch wrapper so the budget is reserved (charged) only when the attempt succeeds. On a 429, release the failed attempt's charge, sleep for `retry-after` (or default), call `waitForCapacity` again, and re-attempt. Only the successful attempt's charge remains in the window.
**Rationale:** A failed request should not consume budget, and a retry must not fire while the window is still over capacity.
**Alternatives considered:**
- Keep charging on failure and rely on the rolling window to evict: over-charges the window and can stall legitimate traffic; rejected.

### Decision 6: Document `maxConcurrency` semantics
**Choice:** Add JSDoc/comment clarifying that `maxConcurrency` is a `ChatOpenAI` field that is accepted and passed through, but the dispatch path does not use it to gate concurrent model calls; actual concurrency comes from parallel subagents, and the shared token budget is the enforcement point.
**Rationale:** Prevents the misreading that `maxConcurrency` bounds what the budget sees.

## Architecture

```
createDeepAgentsOrchestrator
  └─ createChatModel(providerConfig)          [orchestrator]
  └─ createSubagentDefinitions(...)
        └─ createChatModel({...providerConfig, temperature})  [per subagent]

createChatModel (src/provider/openai.js)
  └─ sharedTokenBudget (module-level singleton, keyed by maxTokensMinute)
        ├─ reserve(estimate)      -> atomic wait + record (lock)
        ├─ reconcile(handle, n)   -> adjust entry to actual usage
        └─ current() / consume()  -> existing API (kept)

dispatch wrapper (invoke/stream)
  1. estimate = estimateRequestCost(messages, config)
  2. handle = await budget.reserve(estimate)
  3. try: result = await method(...)
         actual = readUsage(result)
         if actual: budget.reconcile(handle, actual)
         return result
     catch 429:
         budget.release(handle)
         await sleep(retry-after)
         await budget.waitForCapacity(estimate)   # re-pace
         retry once (charge only on success)
     catch other:
         budget.release(handle)
         throw
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Module-level singleton persists across tests / config changes | Reset via an exported `resetTokenBudget()` for tests; key by `maxTokensMinute` so a changed budget re-creates the instance |
| `usage` absent on some providers / streaming | Reconcile only when `usage` is present; otherwise keep the estimate (no crash, no double-charge) |
| Promise-chain lock could grow unbounded under heavy concurrency | The chain only holds pending reservations; each resolves and is dropped. Bounded by in-flight dispatches |
| Reconciliation targets the wrong entry under concurrency | Reserve returns a unique handle bound to the specific entry; reconcile adjusts by handle, not by index |
| Single shared budget assumes one active provider config | Documented; a process runs one provider config. If multiple coexist, first-wins is acceptable and noted |

## Migration Plan

- No data migration. The change is behavioral within the provider layer.
- Rollback: revert the branch; the previous per-instance, estimate-based pacer is restored.
- Deploy: standard release; no config or schema changes required.

## Open Questions

- None blocking. The encoding→model map is seeded with the common tiktoken encodings; additional encodings can be added to the map as needed.
