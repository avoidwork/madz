## Context

The TUI conversation panel scrolls via the custom `ScrollView` component in `src/tui/scrollView.js`, which exposes `scrollBy(delta)` where `delta` is a direct row offset (`scrollTo(scrollOffsetRef.current + delta)`). Mouse-wheel scrolling is handled by the `useMouseScroll` hook in `src/tui/useMouseScroll.js`, which parses SGR mouse sequences, maps wheel-up (button 64) to `-1` and wheel-down (button 65) to `+1` via `buttonToDelta`, and invokes `onScroll(delta)` with that ±1 value. In `src/tui/app.js`, the `useMouseScroll` onScroll callback (around line 445) applies the delta directly: `conversationAreaRef.current?.scrollBy(delta)`.

The `config` prop is already available in the `App` component (line 25), so the configured `mouseScrollLines` value is accessible at the call site without threading new props.

## Goals / Non-Goals

**Goals:**
- Add a configurable `tui.mouseScrollLines` option that sets the number of lines to scroll per mouse wheel event.
- Preserve the existing default behavior of one line per wheel event.
- Validate the option via the `TuiSchema` zod schema (positive integer, default `1`).
- Apply the configured multiplier at the `useMouseScroll` call site in `src/tui/app.js`.

**Non-Goals:**
- No changes to SGR mouse sequence parsing or the button→delta mapping in `useMouseScroll.js`.
- No changes to keyboard scroll routing.
- No changes to `ScrollView` internals (`scrollBy` still takes a direct row offset).
- No new npm dependencies.

## Decisions

### Decision 1: Keep the ±1 delta in `useMouseScroll.js` unchanged
The hook's contract is to emit a unit delta (`-1` for wheel-up, `+1` for wheel-down). The multiplier is applied at the call site in `src/tui/app.js` where the `config` prop is available. This keeps the hook pure and testable, and avoids threading config into the hook.

**Alternatives considered:**
- Passing `mouseScrollLines` into the hook — rejected: couples the hook to config and complicates its test surface; the hook should remain a pure SGR parser/emitter.

### Decision 2: Guard the multiplier at the call site
The callback uses `config?.tui?.mouseScrollLines || 1` to ensure a safe fallback to `1` when config is absent or the value is `0`/`NaN`. This preserves current behavior and avoids `NaN` propagation into `scrollBy`.

**Alternatives considered:**
- Relying solely on zod defaults — rejected: the `config` prop may be undefined in some render paths, so a runtime guard is still needed.

### Decision 3: Validate via zod with `z.number().int().min(1).default(1)`
The schema rejects non-integers, zero, and negatives at parse time, so the runtime multiplier is always a positive integer. The default of `1` preserves backward compatibility for existing configs that omit the key.

**Alternatives considered:**
- `z.number().positive()` — rejected: does not enforce integer-ness; `.int()` is required to prevent fractional scroll steps.

## Risks / Trade-offs

- **[Config prop undefined]** → The `config?.tui?.mouseScrollLines || 1` guard falls back to `1`, preserving current behavior.
- **[Invalid config value]** → zod `min(1)` + `.int()` rejects non-integers, zero, and negatives at parse time; the runtime `|| 1` guard also protects against `0`/`NaN`.
- **[Backward compatibility]** → The default of `1` keeps the existing one-line-per-wheel-event behavior for configs that omit the key.
