CHANGE_NAME: status-bar-model-name

# Display Provider Model Name in Status Bar

## Summary
The status bar shows skills, messages, context, and token counts, but not which model the user is talking to. Add the active provider model name to the status bar, rendered as `[🧠 <model>]` in the right-hand box, to the right of the optional [A/B] maxTokensMinute jewel.

## Technical Approach
The provider-selection logic currently lives in `src/agent/deepAgents.js` (`Object.keys(config.providers)[0] || "openai"`). Extract it into a small shared helper (e.g., `getActiveModelName(config)` or `getActiveProviderConfig(config)`) so the rule isn't duplicated. Use the helper in `index.js` to populate `appInfo.model` (alongside the existing `version`). Thread `model` through `src/tui/inputArea.js` to the `StatusBar`, and render `[🧠 <model>]` in the right-hand box (after the token display, before/around the version) in the existing `#606060` gray, only when a model is configured.

## Trade-offs
- Deriving in `index.js` and passing via `appInfo` keeps the TUI dumb — it just renders what it's given. This is the cleanest plumbing since `config` is already passed to the App.
- The alternative (deriving in the TUI from `config`) avoids new plumbing but duplicates the provider-selection rule. The orchestrator-based alternative is most truthful (shows per-agent overrides) but requires the most plumbing.

## Testing
Unit tests for the helper (returns correct model name, falls back to openai) and the StatusBar render (renders model when configured, omits when not configured).
