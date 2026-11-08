# Proposal

## Why

The TUI already collapses reasoning and tool-call blocks (the `💭 Thinking…` / `🔧 <name>` headers with `→`/`↓` arrows), but the toggle is keyboard-only (ctrl+r / ctrl+t). A mouse click on a block header is the natural interaction for a terminal UI and complements the existing scroll support. This change wires a click to the existing collapse booleans using `@ink-tools/ink-mouse`.

## What Changes

- Add `@ink-tools/ink-mouse` (v2.1.0) as a dependency; its `MouseProvider` wraps the TUI root so mouse events reach child components.
- Attach `useOnMouseClick` to the existing block header lines in `MessageBubble` (the `💭 Thinking…` and `🔧 <name>` elements).
- A click on a reasoning header toggles the existing `reasoningCollapsed` boolean; a click on a tool header toggles the existing `toolCallCollapsed` boolean — the same handlers ctrl+r / ctrl+t already use.
- Thread the toggle callbacks down from `App` through `conversationArea` → `messageList` → `messageBubble`, mirroring how the collapse booleans are already threaded.
- The keyboard toggles (ctrl+r / ctrl+t) remain as a fallback for terminals without mouse support.
- No new component and no new boolean state — the collapse/expand rendering already exists.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `component-message-bubbles`: the collapse toggle for reasoning and tool-call blocks gains a mouse-click path in addition to the existing ctrl+r / ctrl+t keyboard toggles. The click flips the same `reasoningCollapsed` / `toolCallCollapsed` booleans that the keyboard path uses.

## Impact

- **Dependencies**: `@ink-tools/ink-mouse` (v2.1.0, peer `ink >=6` — project uses ink ^8.0.0; `xterm-mouse` v1.0.0 transitive).
- **Code**: `package.json`, `src/tui/app.js` (wrap root in `MouseProvider`, thread toggle callbacks), `src/tui/messageBubble.js` (attach `useOnMouseClick` to header refs), `src/tui/conversationArea.js`, `src/tui/messageList.js` (thread callbacks).
- **Coexistence**: `MouseProvider` must not break the existing `useMouseScroll` wheel/selection pipeline.
- **Tests**: `tests/unit/tui/` — click-toggle behavior.

## Non-goals

- No new `CollapsibleBlock` component — the collapse rendering already exists.
- No new boolean state — the click flips the existing `reasoningCollapsed` / `toolCallCollapsed`.
- No change to the keyboard toggles (ctrl+r / ctrl+t) — they remain as a fallback.
- No change to the collapse rendering itself (arrows, conditional body).
