## Why

The status bar shows skills, messages, context, and token counts, but not which model the user is talking to. When switching providers or models, there's no visual confirmation of the active model. Adding the model name makes the current configuration visible at a glance.

## What Changes

- Display the active provider model name in the status bar, rendered as `[🧠 <model>]` in the right-hand box, to the right of the optional [A/B] maxTokensMinute jewel.
- Derive the model name in `index.js` and add it to `appInfo` (alongside the existing `version`), keeping the TUI dumb.
- Extract the provider-selection logic (`Object.keys(config.providers)[0] || "openai"`) into a shared helper so it isn't duplicated between `deepAgents.js` and `index.js`.
- Render `[🧠 <model>]` only when a model is configured.

## Capabilities

### New Capabilities
- `status-bar-model-name`: The status bar displays the active provider model name as `[🧠 <model>]` in the right-hand box, derived from the configured provider, and omitted when no model is configured.

### Modified Capabilities
<!-- None — this is a new display capability. The existing status-bar-quotes and context-window-status specs are unchanged. -->

## Impact

- **Code**: `index.js` (appInfo), `src/agent/deepAgents.js` (extract provider selection), `src/tui/statusBar.js` (render), `src/tui/inputArea.js` (thread model).
- **Tests**: `tests/unit/tui/statusBar.test.js` (render), plus a test for the shared helper.
- **No schema change**: The model name comes from the existing validated `providers.<name>.model` config.

## Non-goals

- Displaying per-agent temperature overrides.
- Changing the provider-selection rule itself.
- Altering other TUI panels or the orchestrator.
