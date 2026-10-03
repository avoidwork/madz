CHANGE_NAME: copilot-device-flow-provider-selection

## Summary

Fix the init-time GitHub Copilot OAuth device flow so it triggers whenever Copilot is the active (enabled) provider, regardless of its position in `config.yaml`. Currently the startup auth check in `index.js` selects the active provider via `Object.keys(config.providers)[0]` — the first config key — ignoring the `enabled` boolean. When Copilot is enabled but not the first provider, the check inspects a non-Copilot provider and skips the device flow entirely, so no token is acquired and Copilot requests fail with `400 bad request: Authorization header is badly formatted`.

## Technical Approach

The dispatch path (`src/agent/deepAgents.js`) and the TUI (`src/tui/app.js`) both already use `getActiveProviderName(config)` / `getActiveProviderConfig(config)` from `src/provider/openai.js`, which return the first provider whose `enabled !== false`. Only the init-time auth check in `index.js` uses the raw first-key lookup, so it can inspect the wrong provider.

The fix is a one-line change in `index.js`: replace `const activeProviderName = Object.keys(config?.providers || {})[0] || "openai";` with `const activeProviderName = getActiveProviderName(config);`, importing `getActiveProviderName` from `./src/provider/openai.js`. The existing `if (activeProvider.type === "github-copilot")` guard then correctly gates the device flow on the active provider.

## Files to Change

- `index.js` — swap the first-key lookup for `getActiveProviderName(config)`; add the import.
- `tests/unit/provider/openai.test.js` — add a regression test verifying that when copilot is enabled but not the first provider key, `getActiveProviderName` returns `copilot`.

## Architectural Decisions

- Reuse the shared selector rather than duplicating the `enabled !== false` logic. This keeps the startup check consistent with the dispatch path and TUI, and centralizes the selection rule in one place.
- No changes to `copilotAuth.js` — `getAuthPrompt()` already short-circuits to `null` when a token is present, and the startup check only calls it when the active provider is Copilot.

## Trade-offs

- The fix is minimal and low-risk. It does not alter the dispatch path or TUI behavior, which already use the correct selector.
