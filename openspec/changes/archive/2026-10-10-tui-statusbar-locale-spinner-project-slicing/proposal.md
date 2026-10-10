## Why

The TUI status bar has three defects: it formats numbers using the date-format locale (`Intl.DateTimeFormat().resolvedOptions().locale`) instead of the number-format locale, it hardcodes the streaming spinner color to cyan regardless of how close the conversation is to the model's context window, and it slices the project path with a fragile `includes("projects/")` + `lastIndexOf` string match. These are correctness and UX issues in a component the user sees on every interaction.

## What Changes

- Replace `Intl.DateTimeFormat().resolvedOptions().locale` with `Intl.NumberFormat().resolvedOptions().locale` in `src/tui/statusBar.js`, cached once at module load.
- Color the streaming spinner by context-window utilization: 0-60% cyan, 61-80% orange, 81-100% red, falling back to cyan when no context window is configured.
- Add a `contextWindow` config field (default 128000) to the OpenAI and Copilot provider schemas and `config.yaml`, and update it at runtime from the resolved model context length.
- Replace the `project.includes("projects/")` + `lastIndexOf` string match with `path.basename()`, preserving the fallback to the full path when not under a `projects/` directory.

## Capabilities

### New Capabilities
- `status-bar-locale-spinner-project-slicing`: Covers the status bar's locale-correct number formatting, context-utilization spinner coloring, and robust project-path slicing.

### Modified Capabilities
<!-- No existing spec-level behavior changes; the project display and status bar visibility requirements are unchanged. -->

## Impact

- `src/tui/statusBar.js` — locale caching, spinner color helper, project slicing.
- `src/tui/inputArea.js` — forward `contextWindow` prop to StatusBar.
- `src/tui/app.js` — derive `contextWindow` from the active provider config.
- `src/config/schemas/providers.js` — add `contextWindow` field to OpenAI and Copilot schemas.
- `config.yaml` — add `contextWindow: 128000` under both providers.
- `src/agent/deepAgents.js` — update the active provider's `contextWindow` from the resolved model context length.
- `tests/unit/tui/statusBar.test.js` — update locale/project tests, add utilization-helper tests.

## Non-goals

- No change to the status bar's element visibility configuration (`status-bar-visibility`).
- No change to the context-window display semantics (`context-window-status`).
- No change to the spinner animation type or the streaming indicator's always-render behavior.
