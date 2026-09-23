## Context

`src/agent/deepAgents.js` builds the orchestrator with `createDeepAgent()` and adds
only `createCodeInterpreterMiddleware()` and a conditionally-spread
`createTokenBudgetMiddleware()` to the `middleware` array. Summarization arrives
automatically from deepagentsjs v1.14.0, which injects
`createSummarizationMiddleware({ backend })` into the orchestrator default stack
(bundle line 6743) and into `createSubagentDefaultMiddleware()` (line 6675).

`createChatModel()` in `src/provider/openai.js` (~line 127) constructs
`new ChatOpenAI(opts)` and never sets `profile`. `computeSummarizationDefaults()`
therefore takes the fallback branch, yielding a 170,000-token trigger and keep-6.
A live probe of madz's exact model shape confirmed this and returned:

```
{"trigger":{"type":"tokens","value":170000},"keep":{"type":"messages","value":6},
 "truncateArgsSettings":{"trigger":{"type":"messages","value":20},
 "keep":{"type":"messages","value":20}}}
```

There is no summarization config anywhere in `src/config/` today. This is new
surface area.

### Constraints

- Unset config must reproduce current behavior byte-for-byte (170k / keep 6 /
  truncation on). No behavior change for existing users.
- `deepagents` v1.14.0 already exports `createSummarizationMiddleware`; no new package.
- `langchain` (source of `createMiddleware`) is **not** a declared madz dependency —
  it resolves only transitively via `deepagents`. The factory must not import it.
- Repo is public: no internal hostnames or vendor model IDs in code, docs, or tests.
- `npm run lint` and `npm run test` (3817 tests) must pass; no real API calls in tests.

### Architecture

The change touches three subsystems — config, provider, and agent orchestration:

```
config.yaml ──summarization:──▶ src/config/schemas/summarization.js   (new Zod section)
                                       │  re-export via schemas/index.js
                                       ▼
                              src/config/config.js  ConfigSchema.summarization
                                       │  KNOWN_SECTIONS + syncEnv derive automatically
                                       ▼
                              src/config/loader.js ──▶ config.summarization
                                       │
                                       ▼
src/agent/deepAgents.js ──▶ createSummarizationMiddleware(config.summarization, backend)
    │                          src/provider/summarizationMiddleware.js (new, null-when-disabled)
    │                              │  returns deepagents middleware named "SummarizationMiddleware"
    ▼                              ▼
createDeepAgent({ middleware: [ codeInterpreter, customSummarization?, tokenBudget? ] })
                                       │
                                       ▼
              deepagents mergeMiddlewareStack(defaults, customMiddleware, tail)
                                       │  same-name entry REPLACES the library default in place
                                       ▼
        agent.options.middleware = [FilesystemMiddleware, subAgentMiddleware,
                                    SummarizationMiddleware(custom), patchToolCallsMiddleware]
```

## Goals / Non-Goals

**Goals:**
- Expose summarization `trigger` / `keep` / tool-arg truncation thresholds in
  `config.yaml`, Zod-validated, with `SUMMARIZATION_*` env overrides for free.
- Replace the library default `SummarizationMiddleware` with a configured instance
  for the orchestrator, proven to fire at the configured value at runtime.
- Preserve current behavior exactly when the section is unset.
- Preserve the "tokenBudget is last / innermost" composition invariant.
- Document the subagent coverage boundary honestly rather than implying coverage
  that does not exist.

**Non-Goals:**
- Adopting `excludedMiddleware` / harness profiles (see Decision 1).
- Fixing the existing dead `registerHarnessProfile()` key (Open Question 2).
- Setting `model.profile.maxInputTokens` (getter-only; see Decision 4).
- Extending proactive compaction to subagents (Open Question 1).
- Exposing `fraction` triggers or `historyPathPrefix` (Decisions 5 and 6).
- Asserting the history-offload filename scheme (Open Question 3).

## Decisions

### Decision 1 — Same-name replacement, NOT `excludedMiddleware`

The issue's proposed route (`excludedMiddleware: ["SummarizationMiddleware"]` via a
harness profile, then add a custom instance) is **rejected on probe evidence**.

`mergeMiddlewareStack()` (bundle 3497) → `mergeMiddleware$1()` (3479) does
`merged.set(middleware.name, mw)`, so a custom entry whose `name` is exactly
`SummarizationMiddleware` replaces the library default **in place**. Probe:

```
A (same-name custom only): FilesystemMiddleware,subAgentMiddleware,SummarizationMiddleware,patchToolCallsMiddleware
```

The exclusion filter, however, runs **after** the merge and filters by name
(bundle 6758-6761):

```js
if (harnessProfile.excludedMiddleware.size > 0) {
  middleware = middleware.filter((entry) => !excluded.has(entry.name));
}
```

So combining exclusion with a same-name custom entry removes **both**. Probe:

```
B (excludedMiddleware + same-name custom): FilesystemMiddleware,subAgentMiddleware,patchToolCallsMiddleware
  -> Summarization present? false
```

Route B silently disables compaction entirely — the exact "constructed but never
reached" failure mode this repo has been bitten by twice. Same-name replacement is
the only route that works, and it needs no profile at all.

**Alternative considered:** exclusion via a provider-only `"openai"` key (which does
resolve, unlike madz's current key). Rejected — it destroys the custom middleware.

### Decision 2 — Always pass `keep` explicitly

In `createSummarizationMiddleware` (bundle 2946):
`keep = options.keep ?? { type: "messages", value: DEFAULT_MESSAGES_TO_KEEP }` where
`DEFAULT_MESSAGES_TO_KEEP` is **20**, and `defaultsComputed = trigger != null`.
Passing a `trigger` without a `keep` therefore silently moves keep from the
fallback **6 → 20**. madz always passes `keep` explicitly, defaulting to
`{ type: "messages", value: 6 }` to match the documented current behavior.

### Decision 3 — Always pass `truncateArgsSettings` explicitly

`applyModelDefaults()` early-returns when `defaultsComputed` is true (a custom
trigger sets it), so `truncateArgsSettings` is never derived from the model
defaults. Combined with `shouldTruncateArgs()`: `if (!truncateTrigger) return false`
(bundle 3113), a custom trigger **silently disables tool-argument truncation**. The
factory therefore always passes `truncateArgsSettings`, defaulting to the
fallback-equivalent `{ trigger: {type:"messages",value:20}, keep:
{type:"messages",value:20}, maxLength: 2000 }`.

### Decision 4 — Do not set `model.profile`

`model.profile` is getter-only on `ChatOpenAI`. Probe:

```
assign THROWS: TypeError Cannot set property profile of #<BaseChatOpenAI> which has only a getter
```

Setting `profile.maxInputTokens` would require subclassing or
`Object.defineProperty` — fragile across library upgrades and out of proportion to
the requirement. The explicit-trigger path is the mechanism; `maxInputTokens` stays
a documented non-goal.

### Decision 5 — Exclude `fraction` triggers from the schema

`shouldSummarize()` handles `fraction` only when `maxInputTokens` is resolvable from
`resolvedModel.profile.maxInputTokens`. madz never sets a profile, so
`fraction` triggers can never fire — they would be dead config that silently does
nothing. **The schema accepts only `tokens` and `messages`.** This is surfaced as
Open Question 4 for the user, since the issue text mentions `fraction`.

### Decision 6 — Do not expose `historyPathPrefix`

It is untrusted path input; the issue's own security section requires traversal
rejection and sandbox-root confinement. It is not needed for proactive compaction,
so YAGNI applies. If the user wants it later, it needs its own validation spec.

### Decision 7 — Factory shape mirrors `tokenBudgetMiddleware.js`

`createSummarizationMiddleware()` in `src/provider/summarizationMiddleware.js`
returns `null` when `enabled` is false, and the call site uses a conditional spread.
The name collides with the deepagents export, so the local factory is imported under
an alias at the call site (`createConfiguredSummarizationMiddleware`) to keep both
importable in one module. The factory must **not** import `createMiddleware` from
`langchain` (not a declared dependency) — it only forwards to the deepagents factory.

### Decision 8 — Insertion point preserves the tokenBudget invariant

`src/agent/deepAgents.js` documents that `tokenBudgetMiddleware` is registered LAST
so it composes innermost and observes the *post*-summarization message set. Because
same-name replacement happens **in place** within the default segment (probe A), and
`CodeInterpreterMiddleware` / `TokenBudget` are novel entries appended after the
default segment, the custom summarization entry lands before `TokenBudget`
automatically. The spec pins this ordering explicitly so a future refactor cannot
silently break it.

### Decision 9 — The deepagents factory is injectable for tests
`createTokenBudgetMiddleware()` accepts an injectable `budget` precisely because
`node --test` in this repo runs WITHOUT `--experimental-test-module-mocks`, so
`mock.module()` is unavailable and ES module imports cannot be stubbed. The new
factory follows the same pattern: it accepts an optional injected deepagents
summarization factory (defaulting to the real `createSummarizationMiddleware` from
`deepagents`) so tests can capture the exact forwarded options without module
mocking. Without this, the "always pass keep / always pass truncateArgsSettings"
requirements are not unit-testable in this harness.

### Decision 10 — Concrete validation bounds (reject, never clamp)

The issue requires rejecting "non-integer, negative, and absurdly large values
rather than clamping silently" and considering a sane lower bound. Bounds are chosen
to catch typos and cost amplification while never blocking a real context window:

| Field | Type | Bounds |
|---|---|---|
| `trigger.value` | int | `min 2`, `max 10_000_000` |
| `keep.value` | int | `min 1`, `max 10_000_000` |
| `truncateArgs.trigger.value` | int | `min 1`, `max 10_000_000` |
| `truncateArgs.keep.value` | int | `min 1`, `max 10_000_000` |
| `truncateArgs.maxLength` | int | `min 1`, `max 1_000_000` |

- Lower bound `2` on `trigger.value` prevents a pathological config that compacts on
  every single call (unbounded extra LLM cost). `keep` may be `1`.
- Upper bound `10_000_000` tokens is far above any current context window, so it only
  catches typos and DoS-shaped input while leaving 1M-context models unimpeded.
- `type` uses `z.enum(["tokens","messages"])` rather than `z.discriminatedUnion`, so
  `buildReverseMap()` registers the leaf paths as ordinary `enum`/`number` entries and
  `SUMMARIZATION_*` env overrides materialize without special-casing.
- No `.strict()` is applied anywhere, matching every existing section in
  `src/config/schemas/` (zero `.strict()` occurrences repo-wide). Unknown keys are
  therefore stripped, not rejected — consistent with `telemetry`, `memory`, and
  `sandbox`.

### Decision 11 — Runtime proof, not construction proof

Acceptance requires evidence the configured middleware actually fires.
`createDeepAgent()` is synchronous and exposes `agent.options.middleware`, which is
directly assertable — probe-confirmed. The test suite asserts:
1. the effective stack contains exactly one entry named `SummarizationMiddleware`,
2. that entry is the custom instance (identity/`===` against the factory return),
3. the library default instance is absent,
4. `TokenBudget` still composes after it.

A construction-only assertion ("`createSummarizationMiddleware` was called with the
right args") is explicitly insufficient — it cannot detect a middleware filtered out
of the final stack, which is precisely the failure mode Decision 1 documents.

## Risks / Trade-offs

- **Risk:** An overly aggressive `trigger` causes repeated summarization round-trips
  (extra LLM calls and cost).
  → **Mitigation:** Schema enforces a sane lower bound on `trigger.value`; the cost
  implication is documented in `config.yaml` and JSDoc.

- **Risk:** A `trigger` set above the model's real window reintroduces reactive
  overflow, and a `keep` larger than the live message count makes `determineCutoffIndex()`
  return 0 (no compaction).
  → **Mitigation:** These are operator choices, not invalid config — madz validates
  shape, not fitness for a given model. Documented; no silent clamping.

- **Risk:** `tokenEstimationMultiplier` reactive calibration interacts with a
  proactive trigger (adjusted tokens are `totalTokens * multiplier`).
  → **Mitigation:** Both paths remain intact; the multiplier only ever raises
  sensitivity. Documented as expected interaction, not a defect.

- **Risk:** Subagents keep library defaults (170k / 6), so a subagent can still
  overflow reactively even with config set.
  → **Mitigation:** Explicitly specified as a documented boundary, and raised as
  Open Question 1 rather than silently claimed as covered.

- **Trade-off:** `fraction` and `historyPathPrefix` are excluded, so the config
  surface is narrower than the library's. Accepted: dead or unsafe options are worse
  than absent ones.

- **Trade-off:** `enabled` defaults to `false`, so operators must opt in to get
  proactive behavior. Accepted: the hard requirement is zero behavior change when unset.

## Migration Plan

Purely additive; no migration.

1. Land the change. Existing `config.yaml` files validate unchanged — the section
   defaults to `{ enabled: false }` and the factory returns `null`.
2. Operators wanting proactive compaction add a `summarization:` block (or set
   `SUMMARIZATION_ENABLED` / `SUMMARIZATION_TRIGGER_TYPE` / `SUMMARIZATION_TRIGGER_VALUE`
   / `SUMMARIZATION_KEEP_*` env vars).
3. **Rollback:** delete the `summarization:` block (or set `enabled: false`). The
   library default middleware is restored automatically because no custom entry is
   spread into the stack.

## Open Questions

1. **Subagent coverage — in scope?** `buildSubagentMiddleware()` (bundle 6683-6688)
   merges only `input.middleware` for non-forked subagents; top-level custom
   middleware reaches subagents only when `mode === "fork"`. All 12 madz subagent
   definitions carry only `name`/`description`/`systemPrompt` — no `mode`, no
   `middleware` — so the orchestrator override does **not** reach them. Options:
   (a) accept the boundary (current spec), (b) add `middleware` to each subagent
   definition, (c) set `mode: "fork"` (changes subagent semantics broadly).
2. **Fix the dead harness profile — in scope?** `deepAgents.js:~153` registers under
   `${providerName}:${model.replace(/:/g,"-")}`, but `getModelIdentifier()` (bundle
   4270) reads `_defaultConfig.model` / `model_name` / `modelName` — all `undefined`
   for madz's `ChatOpenAI` (probe: `getName()` returns `"ChatOpenAI"`). The key is
   never looked up, so the existing `excludedTools: ["execute","grep","ls"]` profile
   is likely inert today. A provider-only `"openai"` key does resolve (probe: HIT).
   Fixing it is a separate behavior change with its own blast radius.
3. **Offload filename scheme** — three contradictory readings in the bundle
   (`historyPathPrefix` default, a random 12-hex id at line 2696, and a
   `{thread_id}.md` docstring). Must be confirmed empirically before any doc or JSDoc
   asserts it. Not asserted anywhere in this change.
4. **Expose `fraction` triggers?** Currently excluded as dead config (Decision 5). If
   the user wants them, `fraction` requires a model profile to be meaningful — which
   reopens Open Question 2 and Decision 4.
