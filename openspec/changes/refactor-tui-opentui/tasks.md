## 1. Setup and Dependency Changes

- [ ] 1.1 Install Bun (`corepack prepare bun@latest --activate` or via official installer)
- [ ] 1.2 Add `@opentui/core` and `@opentui/react` to package.json dependencies
- [ ] 1.3 Remove `ink`, `ink-scroll-view`, `marked`, `marked-terminal` from package.json dependencies
- [ ] 1.4 Install new dependencies (`bun install`)

## 2. Entry Point

- [ ] 2.1 Replace Ink's `<Application>` wrapper with `createCliRenderer()` / `createRoot()` in `index.js`
- [ ] 2.2 Add `try/finally { renderer.destroy() }` for cleanup
- [ ] 2.3 Update start script from `node index.js --mode interactive` to `bun index.js --mode interactive`
- [ ] 2.4 Update `app.js` imports: replace `React`, `Box`, `Text`, `useWindowSize`, `useInput` from `ink` with `@opentui/react` imports
- [ ] 2.5 Add Bun availability check at top of `index.js`: verify `process.execPath` contains `bun`, log clear error and exit with code 1 if not found

## 3. App Component (app.js)

- [ ] 3.1 Replace all `React.createElement(Box, ...)` with `<box>` JSX and `React.createElement(Text, ...)` with `<text>` JSX
- [ ] 3.2 Replace Ink hooks: `useInput` → `useKeyboard`, `useWindowSize` → `useTerminalDimensions`
- [ ] 3.3 Map key bindings: `key.upArrow` → `key.name === "up"`, `key.downArrow` → `key.name === "down"`, etc.
- [ ] 3.4 Map color props: `"green"` → `#00FF00`, `"cyan"` → `#00FFFF`, `"yellow"` → `#FFFF00`, `"gray"` → `#888888`, `"red"` → `#FF0000`
- [ ] 3.5 Replace `dim: true` with `style={{ dim: true }}` or equivalent
- [ ] 3.6 Map `borderStyle: "round"` → `borderStyle="rounded"`

## 4. Conversation Panel (conversationPanel.js)

- [ ] 4.1 Replace `ink-scroll-view` ScrollView with OpenTUI `<scrollbox stickyScroll={true} stickyStart="bottom">`
- [ ] 4.2 Remove scroll utility functions: `handleScrollInput`, `handleResize`, `handleAutoScroll`, `executeScrollInput`, `executeResize`, `executeAutoScroll` (~70 lines)
- [ ] 4.3 Remove `useInput` scroll handler — ScrollBox handles keyboard navigation natively
- [ ] 4.4 Remove stdout resize listener and `scrollRef.remeasure()` call
- [ ] 4.5 Update `getRoleColors` to return hex values instead of color names
- [ ] 4.6 Update `getBubbleStyle` to return hex values instead of color names
- [ ] 4.7 Convert all `React.createElement` calls to JSX (`<box>`, `<text>`, `<scrollbox>`)

## 5. Input Panel (inputPanel.js)

- [ ] 5.1 Remove `Blink` component and `getBlinkState` / `renderBlink` functions
- [ ] 5.2 Simplify `InputPanel` to display text + static cursor character using `<text>` components
- [ ] 5.3 Convert remaining `React.createElement` calls to JSX

## 6. Markdown Rendering (markdownText.js)

- [ ] 6.1 Remove `marked` and `marked-terminal` imports and `parseMarkdown` function
- [ ] 6.2 Replace custom markdown rendering with OpenTUI's `<markdown content={content} />` component
- [ ] 6.3 Handle streaming: during chat streaming, feed accumulated content into `<markdown>` component

## 7. Remaining TUI Components

- [ ] 7.1 `statusBar.js` — JSX lowercase, hex colors, `style={{ dim: true }}`
- [ ] 7.2 `banner.js` — JSX lowercase, replace `useInput` with `useKeyboard`, map key names
- [ ] 7.3 `skillsPanel.js` — JSX lowercase, `useKeyboard` with `key.name === "up"/"down"`
- [ ] 7.4 `memoryPanel.js` — JSX lowercase, `useKeyboard` with `key.name` mapping
- [ ] 7.5 `settingsPanel.js` — JSX lowercase, `useKeyboard` with `key.name === "return"`
- [ ] 7.6 `onboardingPanel.js` — JSX lowercase, prop mapping (`width: "60"` → `width={60}`)

## 8. Test Updates

- [ ] 8.1 Update `tests/unit/tui.test.js` — replace Ink test helpers with OpenTUI React equivalents
- [ ] 8.2 Verify pure utility tests still pass (`commandParser`, `messages`, `panels`, `hooks` — they import no TUI components that changed)
- [ ] 8.3 Run `npm run test` to verify all tests pass
- [ ] 8.4 Run `npm run coverage` to verify 100% coverage

## 9. Config and Housekeeping

- [ ] 9.1 Remove `tui.blinkTimeout` from config schema at `src/config/schemas.js` if present (grep in design found no current usage — verify schema is clean)
- [ ] 9.2 Keep `tui.cursorChar` in config schema and default value at `src/config/schemas.js:107` — verify unchanged
- [ ] 9.3 Ensure `package.json` dependencies section is clean (no stale references)
- [ ] 9.4 Run `npm run fix` for lint/format compliance
- [ ] 9.5 Run `npm run lint` to verify no warnings
- [ ] 9.6 Verify `src/tui/index.js` exports are still correct for any downstream usage
