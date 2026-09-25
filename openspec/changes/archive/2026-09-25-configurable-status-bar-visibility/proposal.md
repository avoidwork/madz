## Why

The status bar currently always renders every element (model, skills, messages, context, tokens, quote, version). Users may want to hide elements they don't use to reduce visual clutter without losing the bar entirely.

## What Changes

- Add a `tui.statusBar` config block with per-item booleans (`model`, `skills`, `messages`, `context`, `tokens`, `quote`, `version`) that control which status bar elements are visible.
- Each element renders only when its boolean is `true` AND its data is present (e.g., `tokens` also requires `tokenBudget > 0`, `quote` requires a non-empty quote, `model`/`version` require the value).
- The status bar always renders — there is no master toggle.
- The streaming indicator (spinner) is not configurable and always renders.
- All booleans default to `true`, so existing configs (or a bare `statusBar: {}`) resolve to today's behavior exactly.
- The `statusBar` prop defaults to `{}` in the StatusBar component so a missing config never crashes.

## Capabilities

### New Capabilities
- `status-bar-visibility`: Per-item visibility control for the TUI status bar via the `tui.statusBar` config block.

### Modified Capabilities
<!-- No existing spec-level requirements change; this is purely additive. -->

## Impact

- `src/tui/statusBar.js` — add `statusBar = {}` prop, gate 7 elements on boolean AND data presence.
- `src/tui/inputArea.js` — thread `statusBar` into StatusBar props.
- `src/tui/app.js` — pass `statusBar: config?.tui?.statusBar` to InputArea.
- `src/config/schemas/tui.js` — add `statusBar` sub-object with 7 booleans, each `z.boolean().default(true)`.
- `config.yaml` — add `statusBar` block under `tui:`.
- `tests/unit/tui/statusBar.test.js` — add per-item hiding tests.
