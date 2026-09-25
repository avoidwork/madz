# Feature Goals: Display Provider Model Name in Status Bar

## Goal
Display the active provider model name in the status bar, to the right of the optional [A/B] maxTokensMinute jewel, rendered as `[🧠 <model>]` in the same muted gray as other status indicators.

## Scope
- **Included:** Derive the model name in `index.js`, add it to `appInfo`, thread it to the StatusBar, and render `[🧠 <model>]` in the right-hand box. Extract the provider-selection logic into a shared helper.
- **Excluded:** No changes to the orchestrator/agent model selection. No per-agent temperature override display. No changes to other TUI panels.

## Key Requirements
1. Extract the active provider selection logic (`Object.keys(config.providers)[0] || "openai"`) into a shared helper.
2. Populate `appInfo.model` in `index.js` using the helper.
3. Thread `model` from `appInfo` through `inputArea.js` to the `StatusBar`.
4. Render `[🧠 <model>]` in the status bar's right-hand box, only when a model is configured.
5. Add unit tests for the helper and the StatusBar render.

## Acceptance Criteria
- The status bar shows `[🧠 <model>]` when a model is configured.
- The status bar omits the model display when no model is configured.
- The model name is derived from `config.providers[<active>].model`.
- The provider-selection logic is not duplicated between `deepAgents.js` and `index.js`.

## Dependencies
- `index.js` — appInfo construction.
- `src/agent/deepAgents.js` — existing provider selection logic to extract.
- `src/tui/statusBar.js` — render point.
- `src/tui/inputArea.js` — StatusBar invocation.

## Risks / Edge Cases
- No providers configured → fall back to `openai` (existing behavior).
- Long model names (e.g., `openrouter/auto`) — may need truncation or clipping.
- Model name with special characters.
- The `🧠` glyph (U+1F9E0) must render correctly in the terminal.
