# Design

## Context

Collapse state lives in `App` (`reasoningCollapsed`, `toolCallCollapsed`) and is threaded to `MessageBubble`. Messages render inside `VirtualScrollView`, which scrolls via Ink's `contentOffsetY`. `useMouseScroll` already owns wheel/selection and toggles SGR reporting based on input focus.

## Decisions

1. **Use `@ink-tools/ink-mouse`** `MouseProvider` + `useOnClick` for click delivery (user-specified).
2. **One hook per bubble, header hit-testing by hand.** Hooks cannot run per-segment inside `.map`, and a new component is out of scope, so each bubble registers a single `useOnClick` and tests the click against the header `Box` refs it collects. This is also the "validate coordinates against header bounds" requirement.
3. **Scroll compensation.** ink-mouse computes bounds from layout positions that ignore `contentOffsetY`. The hit-test subtracts the current scroll offset (from `ScrollContext.getScrollOffset`) and clips to the viewport rect (`ScrollContext.getViewportRect`). Strict half-open bounds are used.
4. **Coexistence with `useMouseScroll`.** `MouseProvider` uses `autoEnable={false}`; a small `MouseGate` child calls `enable()/disable()` with the same `!inputFocused` condition as `useMouseScroll`, so reporting is on/off together. Clicks therefore work when the conversation is focused (tab out of input), consistent with wheel/selection, preserving native terminal selection while typing.
5. **Streaming gate** lives in the `App` callbacks via a ref of `isStreaming`, and in the bubble (local streaming flag).
6. **Callbacks** are `useCallback`-stable to preserve `React.memo` on `MessageBubble`.

## Risks

- Terminal without mouse support: ink-mouse reports unsupported; keyboard fallback remains.
- ink-mouse relies on Ink node internals (`yogaNode`, `parentNode`); the hit-test uses its exported `getBoundingClientRect`.
