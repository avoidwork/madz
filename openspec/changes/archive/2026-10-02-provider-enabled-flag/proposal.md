## Why

The active provider is currently selected by config position (the first key in `providers`) and Copilot behavior is triggered by `type: github-copilot`. This makes switching providers awkward — the user must reorder the config or mutate the `type` field. From the user's perspective, enabling a provider is "turning it on," so a boolean `enabled` flag is the natural switch.

## What Changes

- Add an `enabled: z.boolean().default(true)` field to both `OpenaiProviderConfigSchema` and `CopilotProviderConfigSchema` in `src/config/schemas/providers.js`.
- Update `getActiveProviderConfig` in `src/provider/openai.js` to select the first provider whose `enabled !== false`, falling back to `openai` when none are enabled.
- Reconcile Copilot detection in `createChatModel` (`isCopilot = config.type === "github-copilot"`) and the TUI guard in `src/tui/app.js` (`activeProviderName !== "github-copilot"`) with the new `enabled`-based selection.
- Add a `copilot` provider block to `config.yaml` mirroring the openai block's expected values (model, base_url, enterpriseUrl, temperature, maxTokens, reasoning, rateLimit), with `enabled` toggling it. The copilot block omits `credentials.apiKey` (OAuth device flow).

## Capabilities

### New Capabilities
- `provider-enabled-flag`: The `enabled` boolean on provider configs and the `enabled`-based active-provider selection rule shared across the orchestrator, model factory, and TUI.

### Modified Capabilities
- `github-copilot-provider`: The Copilot provider config gains an `enabled` field and a `copilot` block in `config.yaml`; active-provider selection no longer relies solely on `type`.
- `config-system`: Provider config schemas gain the `enabled` field; the active provider is selected by `enabled` rather than config position.
- `status-bar-model-name`: The active model name is derived from the first *enabled* provider rather than the first key.

## Impact

- `src/config/schemas/providers.js` — add `enabled` to both provider schemas.
- `src/provider/openai.js` — `getActiveProviderConfig` and `createChatModel` respect `enabled`.
- `src/agent/deepAgents.js` — provider selection aligned with `enabled`-based rule.
- `src/tui/app.js` — copilot auth guard keys off the resolved active provider.
- `config.yaml` — add `copilot` provider block.
- `tests/unit/provider/openai.test.js` and `tests/unit/config/providers.test.js` — new tests for `enabled` selection and schema validation.

## Non-goals

- No change to the OAuth device flow or token persistence for Copilot.
- No change to fallback routing / `fallback_order` semantics.
- No new provider types beyond the existing `openai` and `github-copilot`.
