## Context

The status bar (`src/tui/statusBar.js`) renders status indicators in a left box and version/quote in a right box. The active provider model is configured in `config.yaml` under `providers.<name>.model`, and the active provider is selected in `src/agent/deepAgents.js` via `Object.keys(config.providers)[0] || "openai"`. The `config` object is already passed into the TUI App, and `appInfo` (carrying `version`) is threaded `index.js → App → inputArea → StatusBar`.

## Goals / Non-Goals

**Goals:**
- Display the active provider model name as `[🧠 <model>]` in the status bar's right-hand box.
- Keep the TUI dumb — derive the model in `index.js` and pass it via `appInfo`.
- Avoid duplicating the provider-selection rule.

**Non-Goals:**
- Displaying per-agent temperature overrides.
- Changing the provider-selection rule.
- Altering other TUI panels.

## Decisions

- **Derive in `index.js`, pass via `appInfo`.** The TUI already receives `appInfo` with `version`; adding `model` alongside it requires no new plumbing. `config` is already available in `index.js`.
- **Extract a shared helper.** The provider-selection logic (`Object.keys(config.providers)[0] || "openai"`) currently lives only in `deepAgents.js`. Extract it into a shared helper (e.g., `getActiveModelName(config)`) so `index.js` and `deepAgents.js` share one rule. This avoids drift if the selection logic changes.
- **Render `[🧠 <model>]` in the right box.** Place it after the token display, before/around the version, in the existing `#606060` gray. Only render when `model` is non-empty.
- **Use the `🧠` glyph (U+1F9E0).** Fits the status bar's existing emoji language (`⚡`, `💬`, `▤`, `💎`). The `🤖` glyph was considered as an alternative.

## Risks / Trade-offs

- **Long model names** (e.g., `openrouter/auto`) may overflow the width-constrained status bar. → Mitigation: render as-is for now; truncation can be added later if it becomes an issue.
- **Provider-selection duplication** if the helper isn't used in both places. → Mitigation: the helper is the single source of truth; both `index.js` and `deepAgents.js` call it.
- **Glyph rendering** in the terminal. → Mitigation: `🧠` is a standard emoji; the status bar already renders emoji glyphs.
