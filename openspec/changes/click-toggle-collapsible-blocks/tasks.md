# Tasks

## 1. Dependency setup

- [ ] 1.1 Add `@ink-tools/ink-mouse` (v2.1.0) to `package.json` dependencies and run `npm install`; verify `node -e "require('@ink-tools/ink-mouse')"` resolves and `xterm-mouse` is present in `node_modules`.

## 2. Mouse provider wiring

- [ ] 2.1 Wrap the TUI root `Box` in `src/tui/app.js` with `MouseProvider` from `@ink-tools/ink-mouse`; verify the app renders and the existing `useMouseScroll` wheel/selection still works (run the TUI and confirm wheel scroll + drag selection are unaffected).

## 3. Toggle callback threading

- [ ] 3.1 In `src/tui/app.js`, create stable `onToggleReasoning` / `onToggleToolCall` callbacks via `useCallback` that call the existing `setReasoningCollapsed` / `setToolCallCollapsed`; verify they are stable references (no re-creation per render).
- [ ] 3.2 Thread `onToggleReasoning` / `onToggleToolCall` through `src/tui/conversationArea.js` and `src/tui/messageList.js` to `MessageBubble`, mirroring how `reasoningCollapsed` / `toolCallCollapsed` are threaded; verify the props arrive at `MessageBubble` (add a temporary log or a unit assertion).

## 4. Click handler on block headers

- [ ] 4.1 In `src/tui/messageBubble.js`, attach `useOnMouseClick` to the reasoning block header ref (`💭 Thinking…` line) calling `onToggleReasoning`; verify a simulated click on the header flips `reasoningCollapsed` (unit test in `tests/unit/tui/`).
- [ ] 4.2 In `src/tui/messageBubble.js`, attach `useOnMouseClick` to the tool block header ref (`🔧 <name>` line) calling `onToggleToolCall`; verify a simulated click on the header flips `toolCallCollapsed` (unit test in `tests/unit/tui/`).
- [ ] 4.3 Verify a click outside any header does not toggle either boolean (unit test: click on a non-header region leaves both booleans unchanged).

## 5. Integration and fallback

- [ ] 5.1 Add an integration test in `tests/unit/tui/` that renders the TUI, simulates a click on a tool header, asserts the body collapses, clicks again, and asserts it expands; repeat for a reasoning header.
- [ ] 5.2 Verify the keyboard toggles (ctrl+r / ctrl+t) still flip the booleans after the change (unit test), confirming the fallback path is intact.
- [ ] 5.3 Run `npm run lint`, `npm run test`, and `npm run coverage`; verify all pass and coverage is maintained.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
