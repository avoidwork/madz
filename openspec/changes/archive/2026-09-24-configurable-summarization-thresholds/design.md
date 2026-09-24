## Context

madz inherits `SummarizationMiddleware` from deepagentsjs as a library default. `src/agent/deepAgents.js` only adds `createCodeInterpreterMiddleware()` and `createTokenBudgetMiddleware()` to the `middleware` array — no summarization reference. Because `createChatModel()` in `src/provider/openai.js` never sets a model `profile`, `computeSummarizationDefaults()` falls through to the hardcoded fallback: **trigger 170,000 tokens / keep last 6 messages** (`DEFAULT_MESSAGES_TO_KEEP = 20`).

For a custom model served behind a non-LangChain-profiled `base_url`, the real context window may be considerably smaller than 170k. Compaction is therefore reactive: the first request overflows, the provider throws `ContextOverflowError`, the middleware catches it, performs emergency summarization, and calibrates `tokenEstimationMultiplier` upward. The user pays at least one guaranteed overflowing/failed request before the harness self-corrects.

### Verified library facts (deepagents v1.14.0)

- `createSummarizationMiddleware` and `computeSummarizationDefaults` are **both public exports** of `deepagents`.
- Built-in injection sites: bundle line 6743 (orchestrator default stack) and line 6675 (`createSubagentDefaultMiddleware`) — the middleware governs the orchestrator **and** every subagent.
- `SummarizationMiddleware` is **not** in `REQUIRED_MIDDLEWARE_NAMES` (only `FilesystemMiddleware` and `SubAgentMiddleware`), so excluding it is legal.
- `mergeMiddlewareStack()` keys by `middleware.name`; same-name custom entries **replace** defaults. So a custom middleware named exactly `SummarizationMiddleware` in the `middleware` array already displaces the built-in one for the orchestrator.
- **Gotcha:** in `createSummarizationMiddleware`, `keep = options.keep ?? { type: "messages", value: DEFAULT_MESSAGES_TO_KEEP }` where `DEFAULT_MESSAGES_TO_KEEP` is **20**, and `defaultsComputed = trigger != null`. Passing a `trigger` without a `keep` silently moves keep from the fallback **6 → 20**. madz must pass both explicitly.

### Runtime probe results (the blocker)

Probe against the installed library with madz's exact registration pattern:

```
registered key: openai:custom3.8-27b-mlx
lookup registered key -> HIT
lookup raw identifier ("custom3.8:27b-mlx") -> MISS
lookup provider-only ("openai") -> HIT

m.model = "custom3.8:27b-mlx" | m.modelName = undefined | m.model_name = undefined
profile: {}
computeSummarizationDefaults(m) ->
  {"trigger":{"type":"tokens","value":170000},"keep":{"type":"messages","value":6},
   "truncateArgsSettings":{"trigger":{"type":"messages","value":20},"keep":{"type":"messages","value":20}}}
```

Three consequences:

1. **The fallback values are probe-confirmed, not inferred:** a madz `ChatOpenAI` instance yields exactly `trigger: 170000 tokens / keep: 6 messages`.
2. **`model.profile` is getter-only.** Assigning it throws `TypeError: Cannot set property profile of #<BaseChatOpenAI> which has only a getter`. The explicit-trigger path is the pragmatic route; the profile path is a stretch goal.
3. **The existing harness profile registration is very likely already dead.** `deepAgents.js` line 152 registers under `${providerName}:${model.replace(/:/g, "-")}`, but deepagents resolves profiles via `getModelIdentifier(model)` = `model.model_name ?? model.modelName` — both `undefined` for `new ChatOpenAI({ model })`. The registered key is never looked up; resolution falls through to `EMPTY_HARNESS_PROFILE`. A provider-only key (`"openai"`) **does** resolve.

## Goals / Non-Goals

**Goals:**
- Add a `summarization` config section validated by a Zod schema, with production-safe defaults (170k trigger / keep 6 when unset).
- Wire a custom `SummarizationMiddleware` into the orchestrator stack that fires at the configured threshold.
- Prove the custom middleware fires at runtime (not just that it is constructed).
- Document and verify subagent middleware stack behavior.
- Confirm the offload filename scheme empirically and record it in docs/JSDoc.

**Non-Goals:**
- Setting `profile.maxInputTokens` as the sole approach (rejected as indirect; getter-only).
- Raising the fallback constant or patching the deepagents bundle.
- Exposing only `maxInputTokens`, not trigger/keep.
- Adding new third-party packages.

## Decisions

### Decision 1: Explicit-trigger path over `profile.maxInputTokens`

`model.profile` is getter-only on `ChatOpenAI` — assigning it throws. The explicit-trigger path (`createSummarizationMiddleware({ trigger, keep })`) is the pragmatic route. The profile path is treated as a stretch goal and its mechanism (subclassing or `Object.defineProperty`) is deferred.

### Decision 2: Same-name merge over `excludedMiddleware`

The existing harness profile registration is likely dead (see probe). The same-name-replacement merge semantics are the reliable route for the orchestrator: a custom middleware named exactly `SummarizationMiddleware` in the `middleware` array displaces the built-in default. `excludedMiddleware` is primarily needed for the subagent path, where `buildSubagentMiddleware` filters by `subagentProfile.excludedMiddleware`.

### Decision 3: Always pass `keep` explicitly

In `createSummarizationMiddleware`, `keep = options.keep ?? { type: "messages", value: DEFAULT_MESSAGES_TO_KEEP }` where `DEFAULT_MESSAGES_TO_KEEP` is 20. Passing a `trigger` without a `keep` silently moves keep from the fallback 6 → 20. madz passes both explicitly to preserve current behavior.

### Decision 4: Insert before `tokenBudgetMiddleware`

`tokenBudgetMiddleware` is deliberately registered LAST so it composes innermost and observes the post-summarization message set. Any custom summarization entry must be inserted **before** it or that invariant silently breaks.

### Decision 5: Conditional spread for disabled config

When `enabled` is false (or the section is absent), the middleware factory returns `null` and the entry is spread conditionally — a true no-op. Unset config reproduces today's behavior exactly.

## Risks / Trade-offs

- **[Risk] The custom middleware is built but filtered out of the final stack.** → Mitigation: a runtime probe asserts on the composed `middleware` array actually handed to `createAgent` (or on the observed compaction event), for orchestrator **and** one subagent. Constructing the middleware is not evidence.
- **[Risk] Subagent stack does not pick up the custom middleware.** → Mitigation: verify whether the orchestrator's profile propagates to subagents (they share the `model` instance, so `resolveSubagentProfile` returns the same profile). If exclusion is used, verify it reaches `createSubagentDefaultMiddleware` for every subagent.
- **[Risk] The 6 → 20 keep shift.** → Mitigation: always pass `keep` explicitly; unit test asserts the factory passes both `trigger` and `keep`.
- **[Risk] Offload filename scheme is ambiguous** (sessionId vs. random 12-hex vs. thread_id). → Mitigation: confirm empirically by writing a transcript and inspecting the sandbox filesystem; record the confirmed scheme in docs/JSDoc.
- **[Risk] An overly aggressive trigger causes repeated summarization round-trips (extra LLM calls and cost).** → Mitigation: document the cost implication; the schema rejects non-integer, negative, and absurdly large values rather than clamping silently.

## Migration Plan

No migration. When the new config is unset, behavior is byte-for-byte identical to today (170k trigger / keep 6). When set, compaction triggers at the configured threshold. Rollback is simply removing the `summarization` section from `config.yaml`.

## Open Questions

- Does the custom middleware apply to subagents, or only the orchestrator? (To be verified empirically.)

## Empirical Confirmations (from live probes against deepagents v1.14.0)

### Offload filename scheme — CONFIRMED

`getHistoryPath(state)` builds the path as `${historyPathPrefix}/${getSessionId(state)}.md`, and `getSessionId(state)` returns `session_${crypto.randomUUID().substring(0, 8)}`. The confirmed scheme is:

```
/conversation_history/session_<8-hex>.md
```

This is **neither** the source gist's claimed `<sessionId>.md`, **nor** the random 12-hex id, **nor** `{thread_id}.md`. Observed live: `/conversation_history/session_671428d4.md`. Recorded in the middleware JSDoc.

### Runtime probe — custom middleware fires at the configured value

A real `createAgent` driven with `createSummarizationMiddleware({ backend: new StateBackend(), trigger: { type: "messages", value: 2 }, keep: { type: "messages", value: 1 } })` and 3 input messages produced **two** model invokes (fetch #1 = agent dispatch, fetch #2 = summary generation). This proves the custom middleware fires at the configured trigger (2 messages), not the 170k default. The library default `SummarizationMiddleware` is displaced by the same-name custom entry via `mergeMiddlewareStack` (keys by `middleware.name`).

### Subagent propagation — VERIFIED: does NOT propagate

`buildSubagentMiddleware` (bundle line 6683) merges the orchestrator's `customMiddleware` into a subagent's stack **only when `isForkedSubAgent(input)` is true** (bundle line 6685, `value.mode === "fork"`). madz's subagents are created via `createSubagentDefinitions` and never set `mode: "fork"` — confirmed by grep (no `fork` reference in `src/agent/`). Therefore the custom `SummarizationMiddleware` reaches the **orchestrator only**, not subagents.

This is a deliberate, documented limitation. Subagents continue to use deepagents' library-default `SummarizationMiddleware` (170k trigger / keep 6) via `createSubagentDefaultMiddleware` (bundle line 6675). If subagent-level proactive compaction is ever required, the subagent specs would need `mode: "fork"` or an explicit `middleware` array — out of scope for this change.
