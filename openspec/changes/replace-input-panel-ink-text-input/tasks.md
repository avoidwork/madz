## 1. Setup

- [ ] 1.1 Add `ink-text-input` dependency to package.json
- [ ] 1.2 Run `npm install` to install the new dependency

## 2. Replace InputPanel Component

- [ ] 2.1 Replace `src/tui/inputPanel.js` Blink component with `ink-text-input` wrapper
- [ ] 2.2 Wire `ink-text-input` props: value, onChange, onSubmit, onFocus, onBlur
- [ ] 2.3 Pass `cursorChar` and `cursorColor` from config to ink-text-input
- [ ] 2.4 Remove the `Blink` component (no longer needed)

## 3. Update App Component

- [ ] 3.1 Replace `InputPanel` import with new input component
- [ ] 3.2 Update App's input state management — remove `inputText` state, use component's internal state
- [ ] 3.3 Wire `onSubmit` callback to existing `handleSubmit`
- [ ] 3.4 Wire `onChange` callback to preserve history navigation state
- [ ] 3.5 Wire `onFocus`/`onBlur` callbacks to manage `inputFocused` state
- [ ] 3.6 Simplify App's `useInput` hook — remove input-focused keystroke cases, keep Tab, Escape (when not focused), and message list navigation
- [ ] 3.7 Preserve history navigation via App-level handling (up/down arrows when input focused)
- [ ] 3.8 Preserve onboarding input flow (separate useInput path)

## 4. Update Tests

- [ ] 4.1 Update `tests/unit/tui/conversationPanel.test.js` if InputPanel is referenced
- [ ] 4.2 Update `tests/unit/tui/tui.test.js` for new input component behavior
- [ ] 4.3 Add test for input component onSubmit callback
- [ ] 4.4 Add test for input component focus/blur handling

## 5. Verify

- [ ] 5.1 Run `npm run test` — all tests pass
- [ ] 5.2 Run `npm run lint` — no lint errors
- [ ] 5.3 Run `npm run coverage` — coverage maintained
- [ ] 5.4 Run `npm start` — application starts without crashing
