## Why

madz inherits `SummarizationMiddleware` from deepagentsjs as a library default and has no madz-side config surface to change its thresholds. For custom models served behind a non-LangChain-profiled `base_url`, context compaction is reactive: the user pays at least one guaranteed overflowing/failed request before the harness self-corrects. This change adds a `config.yaml` surface for summarization trigger/keep thresholds wired into the orchestrator middleware stack, so compaction can be proactive.

## What Changes

- **Add a `summarization` config section** backed by a new Zod schema (`src/config/schemas/summarization.js`), exposing `enabled`, `trigger` (`tokens` | `messages` | `fraction`), `keep`, and optional `historyPathPrefix`. Registered in `ConfigSchema` in `src/config/config.js`.
- **Add a middleware factory** (`src/provider/summarizationMiddleware.js`) that returns `createSummarizationMiddleware({ backend, trigger, keep, historyPathPrefix })` from `deepagents` when enabled, or `null` when disabled. **Always passes `keep` explicitly** to avoid the 6 → 20 default shift.
- **Wire it into the orchestrator** in `src/agent/deepAgents.js`, inserted **before** `tokenBudgetMiddleware` and named exactly `SummarizationMiddleware` so the same-name merge displaces the library default.
- **Prove it fires at runtime** via a runtime probe showing compaction at the configured value (not the 170k default) and that the library default `SummarizationMiddleware` is absent from the effective stack.
- **Confirm the offload filename scheme empirically** and record it in docs/JSDoc.
- **Production-safe defaults**: when the new config is unset, behavior is byte-for-byte identical to today (170k trigger / keep 6).

## Capabilities

### New Capabilities
- `summarization-config`: The `config.yaml` surface for summarization trigger/keep thresholds, validated by Zod, wired into the orchestrator middleware stack.

### Modified Capabilities
<!-- None. The existing `compaction` spec describes the compaction *tool* (semantic session summarization via a spawned node process), which is a distinct concern from the deepagents `SummarizationMiddleware` thresholds. This change introduces a new capability rather than modifying that tool spec. -->

## Impact

- **Affected code:** `src/config/schemas/summarization.js` (new), `src/config/schemas/index.js`, `src/config/config.js`, `src/provider/summarizationMiddleware.js` (new), `src/agent/deepAgents.js`, and their tests.
- **No dependency changes.** `createSummarizationMiddleware` is a public export of `deepagents` (v1.14.0, already a dependency). `zod` is already used.
- **Behavior change:** when the new config is set, compaction triggers at the configured threshold instead of the 170k fallback. When unset, no behavior change.

## Non-goals

- Setting `profile.maxInputTokens` as the sole approach (rejected as indirect; `model.profile` is getter-only on `ChatOpenAI`).
- Raising the fallback constant or patching the deepagents bundle.
- Exposing only `maxInputTokens`, not trigger/keep.
- Adding new third-party packages.
