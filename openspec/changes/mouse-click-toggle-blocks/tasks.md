# Tasks

## 1. Dependency
- [ ] 1.1 Add `@ink-tools/ink-mouse` 2.1.0 to `package.json` / lockfile.

## 2. Helper
- [ ] 2.1 Add `src/tui/headerClick.js` (hit-test helpers, `MouseGate`).

## 3. Wiring
- [ ] 3.1 Wrap `App` root in `MouseProvider`; add `MouseGate` bound to `!inputFocused`; add stable `onToggleReasoning` / `onToggleToolCall` (streaming-gated).
- [ ] 3.2 Thread callbacks through `conversationArea`, `conversationPanel`, `messageList` to `MessageBubble`.
- [ ] 3.3 Expose scroll offset / viewport rect to bubbles via `ScrollContext`.

## 4. Bubble click handling
- [ ] 4.1 In `messageBubble.js`, add header refs and one `useOnClick`; toggle the matching callback on a header hit.

## 5. Tests and verification
- [ ] 5.1 Unit tests for `headerClick.js` and bubble header hit-testing.
- [ ] 5.2 Integration test: bubble under `MouseProvider` with simulated click: tool and reasoning toggle, outside no-toggle, streaming no-toggle.
- [ ] 5.3 Keyboard toggles still work.
- [ ] 5.4 `npm run lint`, `npm run test`, `npm run coverage` pass.
