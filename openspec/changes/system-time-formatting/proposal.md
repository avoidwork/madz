## Why

Timestamps in the conversation panel are hardcoded to a plain `HH:MM` format using `date.getHours()` and `date.getMinutes()`. This ignores the user's system locale and cultural time format preferences, making the TUI feel inconsistent on non-English or non-US systems.

## What Changes

- Replace the hardcoded `formatTime()` function in `conversationPanel.js` with `Intl.DateTimeFormat` using the browser/Node default locale.
- Cache the `Intl.DateTimeFormat` instance in a module-level constant to avoid recomputing the formatter for every message render.

## Capabilities

### Modified Capabilities

- `tui-interface`: The TUI will use system-localized time formatting for conversation timestamps instead of a hardcoded HH:MM string.

## Impact

- `src/tui/conversationPanel.js` — `formatTime()` function replaced, formatter cached as a `const`.
- `tests/unit/tui.test.js` — test for time formatting updated to verify localized output.
