## Why

madz inherits `SummarizationMiddleware` from deepagentsjs as a library default and
has no madz-side config surface to change its thresholds. `createChatModel()`
never sets a model `profile`, so `computeSummarizationDefaults()` falls through to
the hardcoded fallback — a 170,000-token trigger, keep 6 messages (probe-confirmed
against the installed library). For a custom model behind an OpenAI-compatible
`base_url` whose real context window is far smaller than 170k, compaction is
strictly *reactive*: the first request overflows, the provider throws, the
middleware performs emergency summarization and calibrates
`tokenEstimationMultiplier` upward. The user pays at least one guaranteed
overflowing request per session before the harness self-corrects.

## What Changes

- Add a `summarization:` section to `config.yaml`, backed by a new
  `SummarizationSchema` in `src/config/schemas/summarization.js`, re-exported from
  `src/config/schemas/index.js` and composed in `src/config/config.js` as
  `summarization: SummarizationSchema.default({})`. `KNOWN_SECTIONS` and
  `syncEnv()` derive from `ConfigSchema`, so `SUMMARIZATION_*` env overrides arrive
  with no change to `loader.js`.
- Add `src/provider/summarizationMiddleware.js`, mirroring
  `tokenBudgetMiddleware.js`'s null-when-disabled + conditional-spread pattern. It
  always passes `keep` and `truncateArgsSettings` explicitly, because omitting
  them silently drifts keep 6 → 20 and silently disables tool-argument truncation.
- Wire it into `src/agent/deepAgents.js` via **same-name replacement** in the
  `middleware` array. The `excludedMiddleware` route recommended by the issue is
  explicitly rejected: probe-confirmed, exclusion filters by name *after* the
  merge and removes the custom replacement too, disabling compaction entirely.
- Unset config reproduces today's behavior exactly (170k / keep 6 / truncation on).
- Document that the override reaches the orchestrator only; madz's subagents carry
  no `mode`/`middleware`, so they stay on library defaults.

## Capabilities

### New Capabilities
- `summarization-config`: The `summarization` config section — `enabled`, `trigger`,
  `keep`, `truncateArgs`, validation bounds, defaults, and env materialization.
- `summarization-middleware`: The middleware factory and its composition into the
  orchestrator stack via same-name replacement, including the runtime proof that
  the configured thresholds actually fire.

### Modified Capabilities

None. No existing spec's requirements change: `config-system` and
`env-config-materialization` already cover "a section exists and is validated /
materialized from env" generically, and `subagent-definitions` requirements are
unchanged because subagent coverage is out of scope here.

## Impact

- **Code:** `src/config/schemas/summarization.js` (new), `src/config/schemas/index.js`,
  `src/config/config.js`, `src/provider/summarizationMiddleware.js` (new),
  `src/agent/deepAgents.js`, `config.yaml`
- **Tests:** `tests/unit/config/summarization.test.js` (new),
  `tests/unit/provider/summarizationMiddleware.test.js` (new), `tests/unit/deepAgents.test.js`
- **Dependencies:** None new. `createSummarizationMiddleware` is a public
  `deepagents` export.
- **Config:** Existing `config.yaml` files keep working; the section defaults to disabled.
- **Breaking changes:** None.

## Non-goals

- Adopting `excludedMiddleware` / harness profiles (provably destructive here).
- Fixing madz's existing dead `registerHarnessProfile()` key — raised as an open
  question for the user, not silently resolved.
- Setting `model.profile.maxInputTokens` (`profile` is getter-only; assignment throws).
- Extending proactive compaction to subagents — raised as an open question.
- Exposing `fraction` triggers (dead without a model profile) or
  `historyPathPrefix` (untrusted path input, scheme unverified).
- Asserting the offload filename scheme — ambiguous in the bundle.
