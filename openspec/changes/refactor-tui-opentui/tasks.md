## 1. Setup and Dependency Changes

- [x] 1.1 Install Bun (`corepack prepare bun@latest --activate` or via official installer)
- [x] 1.2 Add `@opentui/core` and `@opentui/react` to package.json dependencies
- [x] 1.3 Remove `ink`, `ink-scroll-view`, `marked`, `marked-terminal` from package.json dependencies
- [x] 1.4 Install new dependencies (`bun install`)

## 2. Entry Point

- [x] 2.1 Replace Ink's `<Application>` wrapper with `createCliRenderer()` / `createRoot()` in `index.js`
- [x] 2.2 Add `try/finally { renderer.destroy() }` for cleanup
- [x] 2.3 Update start script from `node index.js --mode interactive` to `bun index.js --mode interactive`
- [x] 2.4 Update `app.js` imports: replace `React`, `Box`, `Text`, `useWindowSize`, `useInput` from `ink` with `@opentui/react` imports
- [x] 2.5 Add Bun availability check at top of `index.js`: verify `process.execPath` contains `bun`, log clear error and exit with code 1 if not found

## 3. App Component (app.js)

- [x] 3.1 Replace all `React.createElement(Box, ...)` with `<box>` JSX and `React.createElement(Text, ...)` with `<text>` JSX
- [x] 3.2 Replace Ink hooks: `useInput` → `useKeyboard`, `useWindowSize` → `useTerminalDimensions`
- [x] 3.3 Map key bindings: `key.upArrow` → `key.name === "up"`, `key.downArrow` → `key.name === "down"`, etc.
- [x] 3.4 Map color props: `"green"` → `#00FF00`, `"cyan"` → `#00FFFF`, `"yellow"` → `#FFFF00`, `"gray"` → `#888888`, `"red"` → `#FF0000`
- [x] 3.5 Replace `dim: true` with `style={{ dim: true }}` or equivalent
- [x] 3.6 Map `borderStyle: "round"` → `borderStyle="rounded"`

## 4. Conversation Panel (conversationPanel.js)

- [x] 4.1 Replace `ink-scroll-view` ScrollView with OpenTUI `<scrollbox stickyScroll={true} stickyStart="bottom">`
- [x] 4.2 Remove scroll utility functions: `handleScrollInput`, `handleResize`, `handleAutoScroll`, `executeScrollInput`, `executeResize`, `executeAutoScroll` (~70 lines)
- [x] 4.3 Remove `useInput` scroll handler — ScrollBox handles keyboard navigation natively
- [x] 4.4 Remove stdout resize listener and `scrollRef.remeasure()` call
- [x] 4.5 Update `getRoleColors` to return hex values instead of color names
- [x] 4.6 Update `getBubbleStyle` to return hex values instead of color names
- [x] 4.7 Convert all `React.createElement` calls to JSX (`<box>`, `<text>`, `<scrollbox>`)

## 5. Input Panel (inputPanel.js)

- [x] 5.1 Remove `Blink` component and `getBlinkState` / `renderBlink` functions
- [x] 5.2 Simplify `InputPanel` to display text + static cursor character using `<text>` components
- [x] 5.3 Convert remaining `React.createElement` calls to JSX

## 6. Markdown Rendering (markdownText.js)

- [x] 6.1 Remove `marked` and `marked-terminal` imports and `parseMarkdown` function
- [x] 6.2 Replace custom markdown rendering with OpenTUI's `<markdown content={content} />` component
- [x] 6.3 Handle streaming: during chat streaming, feed accumulated content into `<markdown>` component

## 7. Remaining TUI Components

- [x] 7.1 `statusBar.js` — JSX lowercase, hex colors, `style={{ dim: true }}`
- [x] 7.2 `banner.js` — JSX lowercase, replace `useInput` with `useKeyboard`, map key names
- [x] 7.3 `skillsPanel.js` — JSX lowercase, `useKeyboard` with `key.name === "up"/"down"`
- [x] 7.4 `memoryPanel.js` — JSX lowercase, `useKeyboard` with `key.name` mapping
- [x] 7.5 `settingsPanel.js` — JSX lowercase, `useKeyboard` with `key.name === "return"`
- [x] 7.6 `onboardingPanel.js` — JSX lowercase, prop mapping (`width: "60"` → `width={60}`)

## 8. Test Updates

- [x] 8.1 Update `tests/unit/tui.test.js` — replace Ink test helpers with OpenTUI React equivalents
- [x] 8.2 Verify pure utility tests still pass (`commandParser`, `messages`, `panels`, `hooks` — they import no TUI components that changed)
- [x] 8.3 Run tests to verify all TUI tests pass
- [x] 8.4 Run coverage to verify coverage

## 9. Config and Housekeeping

- [x] 9.1 Remove `tui.blinkTimeout` from config schema at `src/config/schemas.js` if present (grep in design found no current usage — verify schema is clean)
- [x] 9.2 Keep `tui.cursorChar` in config schema and default value at `src/config/schemas.js:107` — verify unchanged
- [x] 9.3 Ensure `package.json` dependencies section is clean (no stale references)
- [x] 9.4 Run `npm run fix` for lint/format compliance
- [x] 9.5 Run `npm run lint` to verify no warnings
- [x] 9.6 Verify `src/tui/index.js` exports are still correct for any downstream usage
