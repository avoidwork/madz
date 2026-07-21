## 1. Setup

- [x] 1.1 Add `ink-text-input` dependency to package.json
- [x] 1.2 Run `npm install` to install the new dependency

## 2. Replace InputPanel Component

- [x] 2.1 Replace `src/tui/inputPanel.js` Blink component with `ink-text-input` wrapper
- [x] 2.2 Wire `ink-text-input` props: value, onChange, onSubmit, onFocus, onBlur
- [x] 2.3 Pass `cursorChar` and `cursorColor` from config to ink-text-input
- [x] 2.4 Remove the `Blink` component (no longer needed)

## 3. Update App Component

- [x] 3.1 Replace `InputPanel` import with new input component
- [x] 3.2 Update App's input state management — remove `inputText` state, use component's internal state
- [x] 3.3 Wire `onSubmit` callback to existing `handleSubmit`
- [x] 3.4 Wire `onChange` callback to preserve history navigation state
- [x] 3.5 Wire `onFocus`/`onBlur` callbacks to manage `inputFocused` state
- [x] 3.6 Simplify App's `useInput` hook — remove input-focused keystroke cases, keep Tab, Escape (when not focused), and message list navigation
- [x] 3.7 Preserve history navigation via App-level handling (up/down arrows when input focused)
- [x] 3.8 Preserve onboarding input flow (separate useInput path)

## 4. Update Tests

- [x] 4.1 Update `tests/unit/tui/conversationPanel.test.js` if InputPanel is referenced
- [x] 4.2 Update `tests/unit/tui/tui.test.js` for new input component behavior
- [x] 4.3 Add test for input component onSubmit callback
- [x] 4.4 Add test for input component focus/blur handling

## 5. Verify

- [x] 5.1 Run `npm run test` — all tests pass
- [x] 5.2 Run `npm run lint` — no lint errors
- [x] 5.3 Run `npm run coverage` — coverage maintained
- [x] 5.4 Run `npm start` — application starts without crashing
