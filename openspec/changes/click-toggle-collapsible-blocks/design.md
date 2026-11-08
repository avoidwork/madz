# Design

## Context

The TUI is built on Ink v8 with React. Collapse/expand rendering for reasoning and tool-call blocks already exists end-to-end: `reasoningCollapsed` and `toolCallCollapsed` are lifted to `App` (`src/tui/app.js:75-79`) and threaded down through `conversationArea` → `messageList` → `messageBubble` (`src/tui/messageBubble.js:279-280`), which renders the `→`/`↓` arrow and conditionally shows the body. The only toggle path today is keyboard: ctrl+r / ctrl+t in the `App` `useInput` handler. The project already has a hand-rolled SGR mouse pipeline in `src/tui/useMouseScroll.js` (wheel + drag selection), enabled via `\x1b[?1000h\x1b[?1006h\x1b[?1002h`. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Wire a mouse click on a block header to the existing `reasoningCollapsed` / `toolCallCollapsed` booleans, using `@ink-tools/ink-mouse`.
- Reuse the existing toggle handlers — no new state, no new component.
- Coexist with the existing `useMouseScroll` wheel/selection pipeline.
- Keep the keyboard toggles as a fallback.

**Non-Goals:**
- No new `CollapsibleBlock` component.
- No new boolean state.
- No change to the collapse rendering (arrows, conditional body).
- No change to the keyboard toggles.

## Decisions

### Decision 1: Use `@ink-tools/ink-mouse` for the click path

`@ink-tools/ink-mouse` (v2.1.0, peer `ink >=6`, `react >=17`) provides a `MouseProvider` that enables SGR mouse reporting and a `useOnMouseClick(ref, handler)` hook that fires when a click lands on a ref'd element. The project uses ink ^8.0.0, so the peer dep is satisfied.

**Alternative considered:** extending the existing `useMouseScroll` SGR parser to emit a click event. Rejected — the user specified `@ink-tools/ink-mouse`, which provides a purpose-built React click API rather than hand-rolling SGR click parsing.

### Decision 2: Thread toggle callbacks down, mirroring the existing booleans

`setReasoningCollapsed` / `setToolCallCollapsed` live in `App`. The click handler in `MessageBubble` needs access. The cleanest path is a callback prop (e.g., `onToggleReasoning`, `onToggleToolCall`) threaded down through `conversationArea` → `messageList` → `messageBubble`, exactly mirroring how `reasoningCollapsed` / `toolCallCollapsed` are already threaded. The callback calls the existing `setReasoningCollapsed` / `setToolCallCollapsed` — no new state.

**Alternative considered:** a global event bus or context. Rejected — the prop-threading pattern is already established for the booleans; introducing a second mechanism would be inconsistent (AGENTS.md 1.4 DRY).

### Decision 3: Coexist with `useMouseScroll`

Both `MouseProvider` and `useMouseScroll` enable SGR mouse reporting. To avoid double-enabling or double-parsing stdin:
- `MouseProvider` wraps the TUI root in `App`.
- `useMouseScroll` continues to own wheel + drag selection.
- The click path is owned by `@ink-tools/ink-mouse`'s `useOnMouseClick` on the header refs.
- If both enable SGR reporting, the implementation must ensure the enable/disable sequences do not fight (e.g., `useMouseScroll`'s cleanup writing `\x1b[?1000l` while `MouseProvider` keeps it on). The design keeps `useMouseScroll` as the sole owner of the enable/disable escape sequences and lets `MouseProvider` consume the already-enabled stream, OR disables `useMouseScroll`'s reporting when `MouseProvider` is active. The implementation picks the path that avoids double-parsing.

## Risks / Trade-offs

- **[Double SGR reporting]** Both `MouseProvider` and `useMouseScroll` enable SGR. → Mitigation: keep a single owner of the enable/disable escape sequences; verify wheel/selection still work after the change (integration test).
- **[Click during streaming]** A click while a bubble is streaming could toggle a block that is still rendering. → Mitigation: the toggle flips the boolean; the bubble re-renders with the new state on the next commit, which is safe. No special-casing required, but a test covers it.
- **[Click outside any header]** → Mitigation: `useOnMouseClick` is attached only to the header refs, so a click elsewhere does not fire the handler.
- **[Terminal without mouse support]** → Mitigation: the keyboard toggles (ctrl+r / ctrl+t) remain, so the feature degrades gracefully.
- **[Ref threading through memoized components]** `MessageBubble` is `React.memo`'d; the callback prop must be stable (useCallback in App) to avoid breaking memoization. → Mitigation: wrap the toggle callbacks in `useCallback` in `App`.

## Migration Plan

- Add `@ink-tools/ink-mouse` to `package.json` dependencies; run `npm install`.
- Wrap the TUI root in `MouseProvider` in `src/tui/app.js`.
- Thread `onToggleReasoning` / `onToggleToolCall` callbacks down through `conversationArea` → `messageList` → `messageBubble`.
- Attach `useOnMouseClick` to the header refs in `messageBubble.js`.
- Rollback: revert the change branch; the keyboard toggles are untouched, so no user-facing regression.

## Open Questions

- Whether `MouseProvider` and `useMouseScroll` can coexist without double-parsing stdin, or whether `useMouseScroll`'s reporting must be disabled when `MouseProvider` is active. Resolved during implementation by testing wheel/selection after the change; does not change the spec or task breakdown.
