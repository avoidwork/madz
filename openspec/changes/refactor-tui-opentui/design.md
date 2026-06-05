## Context

The TUI at `src/tui/` (~1,400 lines, 16 files) is built on Ink, a React-to-terminal renderer. It uses four separate npm packages to provide scrolling (`ink-scroll-view`), markdown (`marked` + `marked-terminal`), and custom cursor animation. OpenTUI (`@opentui/core` + `@opentui/react`) is a Zig-native renderer with a React reconciler that provides all these capabilities in a single package.

OpenTUI powers OpenCode in production and is actively developed at anomalyco/opentui (11.7k stars). It uses the Yoga layout engine (same as React Native) for flexbox layout, and has native components for scrollbox, input, markdown, text, and box.

The `tui-interface` spec defines behavioral requirements (chat mode, batch mode, keyboard nav, commands, banner) that must be preserved. The `tui-scroll-view`, `input-cursor`, and `markdown-rendering` specs describe current Ink-specific implementations that are being replaced.

## Goals / Non-Goals

**Goals:**
- Replace Ink + `ink-scroll-view` + `marked` + `marked-terminal` with `@opentui/core` + `@opentui/react`
- Preserve all behavioral requirements from `tui-interface` (chat, batch, pipeline, keyboard nav, commands, banner)
- Eliminate ~160 lines of hand-rolled scroll/auto-scroll/resize logic
- Eliminate four npm dependencies, replace with two
- Keep pure utility modules (`panels.js`, `hooks.js`, `messages.js`, `commandParser.js`) untouched

**Non-Goals:**
- Replacing `posix` dependency (not a TUI concern in current code)
- Changing config schema behavior beyond cursor blink removal
- Modifying session factory, memory, scheduler, or other non-TUI subsystems
- Adding new UI features or panels

## Decisions

### Decision: Use OpenTUI React reconciler, not raw renderables
OpenTUI provides two APIs: the imperative renderable API (`new BoxRenderable(...)`, manual `renderer.root.add()`) and the React JSX reconciler (`@opentui/react`). We use the React reconciler because:
- The codebase is already React-based — only JSX element names, props, and hooks change
- State management (`useState`, `useEffect`, `useRef`, `React.memo`) stays identical
- Pure utility modules export unchanged
- Significantly less refactoring cost than imperative rewrite

### Decision: Replace JSX, not refactor to functional components
Current code uses `React.createElement()` everywhere (no JSX transpilation). The refactor uses:
- JSX notation (`<box>`, `<text>`) instead of `React.createElement()` — this is the idiomatic OpenTUI React pattern
- This requires the app to be run with Bun (which has built-in JSX support)
- The OpenTUI React setup (`jsxImportSource: "@opentui/react"`) is handled by Bun's runtime

### Decision: Replace scroll logic with native sticky scroll
Current code in `conversationPanel.js` has ~100 lines of scroll utilities: `handleScrollInput`, `handleResize`, `handleAutoScroll`, `executeScrollInput`, `executeResize`, `executeAutoScroll`. These are all replaced by OpenTUI's `<scrollbox stickyScroll={true} stickyStart="bottom">`. The sticky scroll behavior matches the current "auto-scroll on new message" functionality, and when the user manually scrolls up, sticky scroll pauses (same UX as current scroll-view).

### Decision: Remove blinking cursor animation, keep static display
The `inputPanel.js` currently renders a blinking cursor via `getBlinkState()` and `renderBlink()` driven by an animation counter. The input panel is display-only (all input handling is in `app.js` via `useInput`). We simplify to a static text display with cursor character. This is a minor visual change — the cursor is always visible at the text position.

### Decision: Replace markdown parsing with native component
Current `markdownText.js` uses `marked.parse()` + `marked-terminal` to convert markdown to ANSI escape sequences, then renders in a `Text` component. We replace this with OpenTUI's native `<markdown>` component. The native component supports Tree-sitter syntax highlighting for code blocks, streaming mode, and markdown table rendering — all improvements over the current implementation.

### Decision: Key bindings map to OpenTUI key.event model
Ink's `useInput` passes `(input, key)` where key has boolean props like `key.upArrow`. OpenTUI's `useKeyboard` passes a `KeyEvent` with `key.name` (canonical string like `"up"`, `"down"`, `"return"`). Mapping:
- `key.upArrow` → `key.name === "up"`
- `key.downArrow` → `key.name === "down"`
- `key.return` → `key.name === "return"`
- `key.backspace` → `key.name === "backspace"`
- `key.pageUp` → `key.name === "pageup"`
- `key.pageDown` → `key.name === "pagedown"`

## Risks / Trade-offs

### Risk: OpenTUI requires Bun at runtime
**Impact:** The start script changes from `node index.js --mode interactive` to `bun index.js --mode interactive`.
**Mitigation:** The project's tooling (lint, test, coverage via `oxlint`, `oxfmt`, `node --test`) stays on Node.js. Only the TUI entry point needs Bun. `@opentui/react` is Bun-exclusive today, but Node/Deno support is "in-progress." If Node support lands later, the Bun dependency can be relaxed.

### Risk: JSX lowercase convention changes
**Impact:** All TUI components must use `<box>` / `<text>` / `<scrollbox>` instead of `<Box>` / `<Text>`. Color strings change from named ( `"green"` ) to hex ( `"#00FF00"` ).
**Mitigation:** This is a straightforward find-and-replace across 12 files. No semantic changes.

### Risk: Native scroll behavior may differ from custom logic
**Impact:** OpenTUI's sticky scroll behavior auto-scrolls on new content. The custom logic had additional scroll overflow detection (checking `contentHeight > viewportHeight` during streaming). With sticky scroll, this is built-in and simpler.
**Mitigation:** The sticky scroll spec covers this explicitly — sticky scroll pauses when user scrolls up, matching current behavior.

### Risk: Markdown rendering visual differences
**Impact:** `marked` + `marked-terminal` produces different ANSI output than OpenTUI's native `<markdown>`. Code block highlighting, table rendering, and heading styles may look different.
**Mitigation:** The spec's behavioral requirements (bold renders bold, lists render with bullets, etc.) are preserved. Visual style differences are within acceptable range. If any specific styling is important, it can be tuned via OpenTUI's `SyntaxStyle` API.

## Migration Plan

1. Add `@opentui/core` and `@opentui/react` to `package.json`
2. Remove `ink`, `ink-scroll-view`, `marked`, `marked-terminal`
3. Update entry point (`index.js`) — replace `<Application>` with `createCliRenderer()` / `createRoot()`
4. Update all TUI component files (`app.js`, `conversationPanel.js`, `statusBar.js`, `banner.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js`, `onboardingPanel.js`, `inputPanel.js`, `markdownText.js`)
5. Update tests (`tests/unit/tui.test.js`)
6. Update config validation to remove `tui.blinkTimeout` (no longer relevant)
7. Run `npm run fix` for lint/format compliance — note: lint uses Node, format uses oxfmt which is Node-compatible
8. Run tests for coverage verification

## Open Questions

1. **Config schema:** Should `tui.blinkTimeout` be explicitly removed from the config schema, or just ignored? The current flow uses `tui.cursorChar` and `tui.blinkTimeout` fields — one needs to be explicitly cleaned up.
2. **Bun installation:** Should the `start` script depend on Bun being installed, or provide a fallback error message if Bun is not available?
3. **Streaming markdown performance:** The current streaming display updates message content line-by-line via `setMessages` with a cursor character. With the native `<markdown>` component, streaming updates may need to set `streaming={true}` on the component and append to `content` incrementally — the current `committedContent` accumulation logic in `handleChat` would need to feed into the `<markdown>` content rather than directly to message content strings.
