## Context

The TUI status bar (`src/tui/statusBar.js`) renders 7 discrete elements — model, skills, messages, context, tokens, quote, version — each with a React `key`. The streaming indicator (spinner) is always rendered. Today every element always renders (subject to data presence). Users want per-element visibility control to reduce visual clutter without losing the bar entirely.

## Goals / Non-Goals

**Goals:**
- Add a `tui.statusBar` config block with 7 per-item booleans.
- Gate each element on its boolean AND its data presence.
- Default all booleans to `true` so existing configs resolve to today's behavior.
- Default the `statusBar` prop to `{}` in the StatusBar component so a missing config never crashes.
- Keep the streaming indicator (spinner) always rendered and non-configurable.

**Non-Goals:**
- No master `enabled` toggle — the bar always renders.
- No configurable spinner.
- No change to the status bar's layout, styling, or data sources.

## Decisions

- **Per-item booleans, not a master toggle.** The user explicitly wants the bar to always render even when mostly empty, so a single kill-switch is unnecessary.
- **Boolean AND data presence.** Each element renders only when its boolean is `true` AND its data is present. This preserves existing behavior where e.g. `tokens` requires `tokenBudget > 0`, `quote` requires a non-empty quote, and `model`/`version` require the value.
- **Default `statusBar = {}` in the component.** A missing config must never crash; destructuring with a default object provides a safe fallback.
- **Zod defaults.** Each boolean in `TuiSchema.statusBar` is `z.boolean().default(true)`, so a bare `statusBar: {}` or an absent block resolves to all-true.
- **Threading.** `app.js` passes `statusBar: config?.tui?.statusBar` to `InputArea`, which threads it into the StatusBar props. This keeps the config flow consistent with existing `showToolResults` handling.

## Risks / Trade-offs

- [Risk: A config with `statusBar: null`] → Mitigation: the component default `statusBar = {}` plus `config?.tui?.statusBar` optional chaining handles null/undefined gracefully.
- [Risk: Forgetting to gate an element] → Mitigation: each of the 7 elements is explicitly gated; the spinner is intentionally left ungated.
- [Risk: Behavior drift from today] → Mitigation: all defaults are `true`, so a bare `statusBar: {}` or absent block reproduces today's output exactly.
