## Why

The `rateLimit.maxTokensMinute` config value does not enforce the configured tokens-per-minute budget.

The original diagnosis for this change held that the throttle was "reached on the main dispatch path" and that the defects were limited to what the budget measured and how it was shared. **That premise was wrong.** The throttle is installed by assigning an instance property over `model.invoke` / `model.stream`. The agent never calls those. LangChain's `AgentNode` performs `bindTools(request.model)` before every dispatch, and `ChatOpenAI.bindTools()` delegates to `withConfig()`, which returns a **freshly constructed** `ChatOpenAI` from serializable constructor state. Instance properties do not survive that reconstruction.

Verified against this repository's own module and dependencies:

```
1) direct model.invoke : stubCalls=1  budget 0 -> 70     <- wrapper fires
   bound ctor: ChatOpenAI | bound.invoke === model.invoke ? false
   bound.invoke threw: APIConnectionError (hit REAL transport)
2) bound.invoke        : stubCalls=1  budget 70 -> 70    <- wrapper never fired
```

Every real dispatch — orchestrator and all subagents — bypasses the throttle entirely. A subclass override was also tested and likewise does not survive `bindTools`, so that alternative is closed. `model.stream` was doubly dead: `AgentNode` always calls `.invoke()` and surfaces tokens via stream transformers.

The remaining defects from the original diagnosis are real but secondary: a broken token estimate, per-instance budgets, no reconciliation, no concurrency guard, and charging for failed requests.

## What Changes

- **Move enforcement to `wrapModelCall` middleware** (new `src/provider/tokenBudgetMiddleware.js`). This hook runs inside `AgentNode` around the real dispatch, sees `request.model` / `request.messages` / `request.systemMessage` / `request.tools`, and is the only extension point that survives `bindTools`. Verified live: `["RESERVE(ChatOpenAI)","RELEASE(APIConnectionError)"]`.
- **Remove the instance-property wrapper** from `createChatModel`, along with the `_rawInvoke` / `_rawStream` test hooks. `createChatModel` returns a plain `ChatOpenAI` and no longer claims to throttle.
- **Keep** the shared-budget singleton, `reserve`/`reconcile`/`release`, and the encoder fix — all sound, all still required.
- **Register the middleware** on `createDeepAgent({ middleware: [...] })`, which merges it into the subagent stack as well, so one instance governs the orchestrator and every subagent.
- **Add a regression test that drives a real `createAgent`**, asserting the budget moves. The existing tests asserted against the wrapper directly and could not fail.

## Capabilities

### New Capabilities

- `token-estimation`: How conversation token counts are computed — encoder resolution from model name, tiktoken as the primary path, char/4 as last resort.

### Modified Capabilities

- `provider-token-budget`: Gains atomic `reserve`, `reconcile`, `release`, a shared instance, and enforcement via `wrapModelCall` middleware rather than model-instance wrapping.
- `provider-rate-limit-config`: The instance-wrapping throttle contract is withdrawn; `createChatModel` no longer enforces the budget.

## Impact

- **Affected code:** `src/provider/tokenBudgetMiddleware.js` (new), `src/provider/openai.js`, `src/agent/deepAgents.js`, `src/tui/contextTokens.js`, `src/provider/tokenBudget.js`, and their tests.
- **No dependency changes.** `createMiddleware` is already available from `langchain`.
- **Behavior change:** token pacing becomes a hard, shared, usage-reconciled ceiling on the actual agent dispatch path.

## Non-goals

- Changing the `maxTokensMinute` Zod schema or config surface.
- Adding new rate-limit dimensions (requests/minute, cost-based).
- Patching `langgraph`, `langchain`, or `deepagents`. Middleware is a supported extension point; no fork is required.
- Changing retry policy beyond re-pacing the existing single 429 retry.
