# Feature Goals — Copilot Device Flow Provider Selection

## Goal

Fix the init-time Copilot auth flow so the OAuth device flow triggers whenever Copilot is the active (enabled) provider, regardless of its position in `config.yaml`.

## Scope

- **Included:** Correct the active-provider selection in `index.js` to respect the `enabled` flag; add a regression test.
- **Excluded:** No changes to the dispatch path, TUI, or `copilotAuth.js` — those already use the correct selector.

## Key Requirements

1. In `index.js`, replace the raw first-key lookup (`Object.keys(config.providers)[0]`) with `getActiveProviderName(config)`.
2. `getActiveProviderName` must be imported from `./src/provider/openai.js`.
3. The `if (activeProvider.type === "github-copilot")` guard must remain intact.
4. Add a regression test verifying that when copilot is enabled but not the first provider key, `getActiveProviderName` returns `copilot`.

## Acceptance Criteria

- When `copilot.enabled: true` and `openai.enabled: false` (with openai listed first), the startup auth check selects copilot and triggers the device flow.
- Existing tests pass; no regressions.

## Dependencies

- `src/provider/openai.js` — exports `getActiveProviderName`.
- `src/tui/app.js` and `src/agent/deepAgents.js` — already use the correct selector (reference only).

## Risks / Edge Cases

- No providers enabled → `getActiveProviderName` falls back to `openai` (existing behavior preserved).
- Copilot first and enabled → unchanged behavior.
- Copilot enabled but not first → the bug being fixed.
