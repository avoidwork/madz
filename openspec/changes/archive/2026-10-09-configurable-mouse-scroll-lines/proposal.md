## Why

The TUI conversation panel scrolls exactly one line per mouse wheel event, hardcoded in the `useMouseScroll` onScroll callback in `src/tui/app.js`. Users with high-resolution trackpads or fast-scrolling wheels find one line per event too slow, and there is no way to tune the scroll step. This change makes the scroll step configurable via a `tui.mouseScrollLines` option while preserving the existing default of one line per wheel event.

## What Changes

- Add a `mouseScrollLines` integer option (default `1`, minimum `1`) to the `TuiSchema` zod schema in `src/config/schemas/tui.js`.
- Add `mouseScrollLines: 1` to the `tui:` section of `config.yaml`.
- In `src/tui/app.js`, multiply the parsed wheel delta (±1) by the configured `mouseScrollLines` value before calling `conversationAreaRef.current?.scrollBy(...)`, with a safe fallback to `1` when the config value is absent.
- Add unit tests verifying the schema default/validation and the delta multiplication logic.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `tui-config`: Add the `tui.mouseScrollLines` configuration option, its default, and its validation constraints.
- `tui-mouse-scroll`: Update the mouse-wheel scroll behavior so the scroll step is configurable (N lines per wheel event) rather than fixed at one line.

## Impact

- **Modified**: `src/config/schemas/tui.js` (add `mouseScrollLines` to `TuiSchema`).
- **Modified**: `config.yaml` (add `mouseScrollLines: 1` under `tui:`).
- **Modified**: `src/tui/app.js` (apply the configured multiplier in the `useMouseScroll` onScroll callback).
- **Tests**: `tests/unit/config/mutate.test.js` (or a new config schema test) and `tests/unit/tui/useMouseScroll.test.js` (or a new test).
- **No new npm dependencies.**

## Non-goals

- No changes to SGR mouse sequence parsing or the button→delta mapping in `useMouseScroll.js`.
- No changes to keyboard scroll routing.
- No changes to `ScrollView` internals (`scrollBy` still takes a direct row offset).
