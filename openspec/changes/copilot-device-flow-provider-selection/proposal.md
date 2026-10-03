## Why

The init-time GitHub Copilot OAuth device flow only triggers when Copilot is the first provider key in `config.yaml`. The startup auth check in `index.js` selects the active provider via `Object.keys(config.providers)[0]`, ignoring the `enabled` boolean. When Copilot is enabled but not first, the check inspects a non-Copilot provider and skips the device flow entirely, so no token is acquired and Copilot requests fail with `400 bad request: Authorization header is badly formatted`.

## What Changes

- Replace the raw first-key provider lookup in `index.js` with `getActiveProviderName(config)`, which respects the `enabled` flag.
- Import `getActiveProviderName` from `./src/provider/openai.js`.
- Add a regression test verifying the startup provider selection respects `enabled`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `provider-enabled-flag`: The "Active provider selected by enabled flag" requirement is extended to cover the init-time auth flow in `index.js`, so the startup device-flow trigger uses the same enabled-based selection rule as the orchestrator, model factory, and TUI.

## Impact

- `index.js` — swap the first-key lookup for `getActiveProviderName(config)`; add the import.
- `tests/unit/provider/openai.test.js` — add a regression test for the enabled-based selection.
- No changes to `src/provider/copilotAuth.js`, `src/agent/deepAgents.js`, or `src/tui/app.js` — those already use the correct selector.

## Non-goals

- No changes to the dispatch path, model factory, or TUI provider selection.
- No changes to the OAuth device flow itself (`copilotAuth.js`).
- No changes to the `enabled` schema or config validation.
