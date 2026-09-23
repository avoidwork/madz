## Context

`rateLimit.maxTokensMinute` is a rolling tokens-per-minute budget. The original implementation wired the
throttle by assigning instance properties over `model.invoke` and `model.stream` inside `createChatModel`
(`src/provider/openai.js`).

### The primary defect: the wrapper is never reached

The premise recorded in the first revision of this change — that the dispatch path was "confirmed reached on
every orchestrator/subagent call" — was false. It was inferred from the wrapper's presence, not observed on
the real call graph. What actually happens, in `AgentNode.#invokeModel`
(`langchain/dist/agents/nodes/AgentNode.js`):

```javascript
const modelWithTools = await this.#bindTools(request.model, request, structuredResponseFormat);
const response = await raceWithSignal(modelWithTools.invoke(messages, { ...config, signal }), signal);
```

`ChatOpenAI.bindTools()` (`@langchain/openai/dist/chat_models/base.js:343`) delegates to `this.withConfig()`,
which constructs a **new** model object from serializable constructor state. An instance property assigned onto
the original object is not part of that state and does not survive. The agent dispatches through the new
object; the wrapper is orphaned.

Reproduced against this repository's own module:

```
1) direct model.invoke : stubCalls=1  budget 0 -> 70     <- wrapper fires
   bound ctor: ChatOpenAI | bound.invoke === model.invoke ? false
   bound.invoke threw: APIConnectionError (hit REAL transport)
2) bound.invoke        : stubCalls=1  budget 70 -> 70    <- wrapper never fired
```

The bound call reached the network and left the budget untouched.

Two corollaries, both tested, both closing off tempting fixes:

- **A subclass override does not survive either.** `class BudgetedChatOpenAI extends ChatOpenAI` with a
  `_generate` override: after `bindTools`, the override did not fire. The subclass route is closed.
- **`model.stream` was doubly dead.** `AgentNode` always calls `.invoke()`; streaming is surfaced through
  stream transformers. That wrapper had no caller at all.

### Secondary defects (real, but not the cause)

1. **Broken estimate** — `calculateConversationTokens` (`src/tui/contextTokens.js`) passes the tiktoken
   *encoding* name to `encoding_for_model`, which is keyed by *model* name. It throws, is caught, and silently
   falls back to char/4. The configured encoding is dead code.
2. **Per-instance budget** — `createTokenBudget` was called inside `createChatModel`, so orchestrator plus each
   custom-temperature subagent owned an independent window: real ceiling `N × maxTokensMinute`.
3. **Estimate-only accounting** — the response `usage` was never read back.
4. **No concurrency guard** — `waitForCapacity` + `consume` are separate calls; concurrent dispatches overshoot.
5. **429 retry not re-paced** — the retry slept then re-dispatched without re-checking capacity.
6. **Failed requests consumed budget** — `consume` fired before the try/catch.
7. **`maxConcurrency` misread** — a real `ChatOpenAI` field, but nothing in this path uses it to gate model calls.

## Goals / Non-Goals

**Goals:**
- Enforce `maxTokensMinute` on the path the agent actually takes, verified by observation rather than inference.
- Fix encoder resolution so tiktoken is used for known models/encodings.
- Hoist a single shared budget so all model instances pace against one window.
- Make check-and-consume atomic; reconcile to actual usage; charge only successful attempts.
- Add a regression test that fails if enforcement is ever orphaned again.

**Non-Goals:**
- Changing the `maxTokensMinute` Zod schema or config surface.
- Adding new rate-limit dimensions (requests/minute, cost-based).
- Patching or forking `langgraph`, `langchain`, or `deepagents`.
- Changing retry policy beyond re-pacing the existing single 429 retry.

## Decisions

### Decision 1: Enforce via `wrapModelCall` middleware, not model-instance wrapping
**Choice:** A `createMiddleware({ name: "TokenBudget", wrapModelCall })` in
`src/provider/tokenBudgetMiddleware.js` performs `reserve` → `handler(request)` → `reconcile`/`release`.
Registered on `createDeepAgent({ middleware: [...] })`.

**Rationale:** `wrapModelCall` is invoked by `AgentNode` around the real dispatch, so it cannot be orphaned by
`bindTools`. It also receives `request.model`, `request.messages`, `request.systemMessage`, and `request.tools`
— a materially better estimate surface than the `normalizeMessages` shim it replaces. Verified live on this
stack: `["RESERVE(ChatOpenAI)","RELEASE(APIConnectionError)"]`.

**Alternatives considered:**
- *Instance-property wrapping* (current): orphaned by `bindTools`. Proven broken.
- *Subclass override of `_generate`*: tested; does not survive `bindTools`. Rejected.
- *Patching langgraph/langchain*: unnecessary. Middleware is the supported extension point, and the user's
  initial hypothesis that a langgraph patch was required turned out not to hold.
- *`wrapModelCall` on a per-subagent basis only*: `createDeepAgent` merges `input.middleware` into the subagent
  stack (`deepagents`: `mergeMiddlewareStack(subagentDefaultMiddleware, input.middleware ?? [], ...)`), so a
  single registration covers orchestrator and subagents. Rejected as redundant.

### Decision 2: Register the middleware innermost (last in the array)
**Choice:** Place `TokenBudget` last among `wrapModelCall` middleware.

**Rationale:** `AgentNode` composes the chain by iterating the array backwards, so the **first** entry becomes
outermost and the **last** becomes innermost — closest to the actual model call. Innermost placement means the
estimate is computed from the *final* message set (post-summarization, post-truncation) and reconciliation
targets the real dispatch, not an intermediate one.

**Alternatives considered:** Outermost placement measures a pre-truncation message set, over-charging the
window whenever summarization or truncation shrinks the request.

### Decision 3: Resolve the encoder from the model name, with an explicit encoding→model map
**Choice:** Do not pass a raw encoding name to `encoding_for_model`. For an explicit encoding (param or
`OPENAI_ENCODING`), use `tiktoken.get_encoding(encoding)` directly. Otherwise derive the model name (strip a
`:version` suffix) and pass that to `encoding_for_model`. Fall back to char/4 only when tiktoken is genuinely
unavailable.

**Rationale:** `encoding_for_model` is model-keyed; passing an encoding name is the root cause of the silent
fallback.

### Decision 4: Hoist a single shared budget instance
**Choice:** Module-level lazy singleton in `src/provider/openai.js`, keyed by `maxTokensMinute`, reused by every
`createChatModel` call and by the middleware. Exported `resetTokenBudget()` for tests.

**Rationale:** The orchestrator and all subagents must pace against one window. Retained unchanged from the
first revision — this part was correct.

### Decision 5: Atomic check-and-consume via a promise-chain lock
**Choice:** `reserve(estimatedTokens)` atomically waits for capacity and records the entry under a single
promise-chain lock, returning a handle. `consume`/`waitForCapacity` retained for compatibility.

**Rationale:** `waitForCapacity` + `consume` as separate calls have a check-then-act race. Retained unchanged.

### Decision 6: Reconcile to actual usage after dispatch
**Choice:** After a successful `handler(request)`, read usage via `readUsageTokens` and call
`budget.reconcile(handle, actualTokens)`. When usage is absent, keep the estimate.

**Rationale:** The window should reflect real tokens. Retained unchanged.

### Decision 7: Charge only on success; re-pace the 429 retry
**Choice:** `release(handle)` on any throw. On a 429: release, sleep for `retry-after` (or default), call
`waitForCapacity` again, re-attempt. Only the successful attempt's charge remains.

**Rationale:** A failed request must not consume budget, and a retry must not fire while the window is over
capacity. Retained unchanged.

### Decision 8: `createChatModel` no longer enforces the budget
**Choice:** Remove the entire `wrapDispatch` block and the `_rawInvoke`/`_rawStream` hooks. `createChatModel`
returns a plain `ChatOpenAI`. Its JSDoc states that budget enforcement lives in `TokenBudgetMiddleware`.

**Rationale:** Leaving a non-functional throttle in place is worse than having none — it reads as enforcement
and invites the next reader to trust it. The test hooks existed solely to make the orphaned wrapper observable
in tests, which is the failure mode being eliminated.

## Architecture

```
createDeepAgentsOrchestrator (src/agent/deepAgents.js)
  ├─ createChatModel(providerConfig)                     [orchestrator]  -> plain ChatOpenAI
  ├─ createSubagentDefinitions(...)
  │    └─ createChatModel({...providerConfig, temperature}) [per subagent]
  └─ createDeepAgent({ middleware: [...existing, TokenBudgetMiddleware] })
        └─ deepagents merges input.middleware into EVERY subagent stack

AgentNode.#invokeModel (langchain)
  └─ wrapModelCall chain (first = outermost, last = innermost)
       └─ TokenBudgetMiddleware.wrapModelCall(request, handler)
            1. estimate = estimateRequestCost(request.messages, request.systemMessage, request.tools)
            2. handle = await budget.reserve(estimate)          # atomic wait + record
            3. try:
                 result = await handler(request)                # real dispatch (bindTools happens inside)
                 actual = readUsageTokens(result)
                 if (actual) budget.reconcile(handle, actual)
                 return result
               catch 429:
                 budget.release(handle)
                 await sleep(retry-after)
                 await budget.waitForCapacity(estimate)         # re-pace
                 retry once (charge only on success)
               catch other:
                 budget.release(handle); throw

sharedTokenBudget (module singleton, keyed by maxTokensMinute)
  ├─ reserve(estimate)    -> atomic wait + record (promise-chain lock)
  ├─ reconcile(handle, n) -> adjust entry to actual usage
  ├─ release(handle)      -> remove entry
  └─ current() / consume() / waitForCapacity()  -> existing API retained
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Middleware is absent from a code path that constructs an agent without `createDeepAgent` | The regression test drives a real `createAgent` and asserts the budget moves; any path that drops the middleware fails the test |
| Summarization middleware makes its own `chatModel.invoke()` calls that bypass our hook | Accepted limitation, documented below. Innermost placement (Decision 2) keeps the main path exact; summarization calls are bounded and infrequent. Revisit only if observed drift matters |
| Middleware ordering changed by a future deepagents upgrade | Innermost placement is asserted by test, not assumed |
| Module-level singleton persists across tests / config changes | Exported `resetTokenBudget()`; keyed by `maxTokensMinute` so a changed value re-creates the instance |
| `usage` absent on some providers | Reconcile only when present; otherwise keep the estimate — no crash, no double-charge |
| Reconciliation targets the wrong entry under concurrency | `reserve` returns a unique handle; `reconcile` adjusts by handle, not index |
| Single shared budget assumes one active provider config | Documented; a process runs one provider config, first-wins is acceptable |

## Known Gap: the summarization model call bypasses `wrapModelCall`

`SummarizationMiddleware.createSummary` invokes the model directly rather than through the handler chain:

```javascript
// deepagents langsmith-3LzYb-m7.js:3312 — inside the middleware body, not via handler(request)
return (await chatModel.invoke([new HumanMessage({ content: prompt })])).text;
```

`chatModel` is `request.model ?? await getChatModel()` — the agent's own instance — but because the call is made
inside the middleware's body it never enters `TokenBudget.wrapModelCall` and is not charged to the window.

This is the mirror image of the original defect. The orphaned instance patch happened to catch this one call (a
direct `.invoke()` on the original instance does hit an instance-property override) while missing every real agent
dispatch. The middleware fixes the dominant case and loses this incidental one.

**Decision: accept and document.** Covering it would require *also* patching the model instance — reintroducing the
orphan-patch pattern and creating a double-charge hazard on the normal path. The gap under-counts slightly, which is
conservative in the wrong direction but preferable to counting nothing at all. If drift is ever observed, the fix is
to pass a budget-aware model into the summarization options, not to restore an instance patch.

## Migration Plan

- No data migration; the change is behavioral within the provider/agent wiring.
- Rollback: revert the branch; the previous (non-enforcing) state is restored.
- Deploy: standard release; no config or schema changes required.
- **Verification gate:** before merge, confirm the budget moves on a real agent dispatch. The first revision of
  this change shipped because that check was inferred rather than observed.

## Open Questions

- None blocking. The encoding→model map is seeded with common tiktoken encodings and can be extended.
- Whether summarization's own model calls should eventually be charged. Deferred; see Risks.
