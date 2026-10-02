## Context

The active provider is currently selected by config position — `getActiveProviderConfig` returns `config.providers[Object.keys(config.providers)[0]]`, and Copilot behavior is gated on `type === "github-copilot"`. This couples provider selection to key ordering and the `type` discriminator, making it awkward to switch providers. The user wants an explicit `enabled` boolean so a provider is "turned on" rather than reordered.

## Goals / Non-Goals

**Goals:**
- Add `enabled: z.boolean().default(true)` to `OpenaiProviderConfigSchema` and `CopilotProviderConfigSchema`.
- Make `getActiveProviderConfig` select the first provider with `enabled !== false`, falling back to `openai` when none are enabled.
- Reconcile Copilot detection in `createChatModel` and the TUI guard with the resolved active provider.
- Add a `copilot` provider block to `config.yaml`.

**Non-Goals:**
- No change to OAuth device flow or token persistence.
- No change to `fallback_order` routing semantics.
- No new provider types.

## Decisions

**Decision 1: `enabled` defaults to `true`.** Existing configs without the field must keep working unchanged. `z.boolean().default(true)` preserves backward compatibility while allowing explicit opt-out.

**Decision 2: Selection rule is "first provider with `enabled !== false`".** This keeps the existing "first key wins" behavior for the common case (all enabled), while letting a disabled provider be skipped. The fallback to `openai` mirrors the current fallback when no provider is configured. The rule lives in `getActiveProviderConfig` so the orchestrator, model factory, and TUI share one implementation (DRY).

**Decision 3: Copilot detection keys off the resolved provider's `type`.** `createChatModel` already receives the resolved provider config, so `isCopilot = config.type === "github-copilot"` remains correct once the caller passes the enabled-resolved provider. The TUI guard in `src/tui/app.js` currently checks `activeProviderName !== "github-copilot"`; it should instead check the resolved `activeProvider.type === "github-copilot"` so it aligns with the enabled-based selection.

**Decision 4: `deepAgents.js` uses `getActiveProviderConfig`.** The duplicated `Object.keys(config.providers)[0]` derivation in `deepAgents.js` is replaced by the shared helper, removing the duplicate selection logic.

**Decision 5: Copilot block omits `credentials.apiKey`.** Copilot authenticates via OAuth device flow (bearer token injected through a custom fetch interceptor), so no static `apiKey` is needed. The `enterpriseUrl` field derives the API base for GHEC deployments.

## Risks / Trade-offs

- **[Backward compatibility]** Existing configs without `enabled` must still validate and select the first provider. → Mitigated by `default(true)` and the `enabled !== false` check (undefined is treated as enabled).
- **[Behavior change for disabled providers]** A provider with `enabled: false` is now skipped rather than selected by position. → This is the intended feature; the fallback to `openai` prevents a hard failure when all are disabled.
- **[Duplicated selection logic]** The TUI and `deepAgents.js` previously derived the provider name independently. → Mitigated by routing both through `getActiveProviderConfig`.
