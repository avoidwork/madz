## 1. Update inputPanel.js - Add cursor-position rendering support

- [x] 1.1 Add `cursorPosition` prop to `Blink` component (default: `inputText.length`)
- [x] 1.2 Update `renderBlink` helper to accept `cursorPosition` and render highlighted character
- [x] 1.3 Extract text into `[prefix][highlighted_char][suffix]` segments when cursor is within text
- [x] 1.4 Apply `bgCyan` styling to the character at `cursorPosition` (when cursor is not at end and text is not empty)
- [x] 1.5 Preserve existing blinking cursor behavior (cursor char remains at text end)
- [x] 1.6 Update `InputPanel` to pass `cursorPosition` prop through to `Blink`

## 2. Update app.js - Add cursor navigation state and handlers

- [x] 2.1 Add `cursorPosition` state alongside `inputText` (default: `0`)
- [x] 2.2 Reset `cursorPosition` to `inputText.length` on Enter (submit)
- [x] 2.3 Reset `cursorPosition` to `0` on new session start
- [x] 2.4 In the `useInput` handler, add `ArrowRight` branch: increment cursor to `Math.min(cursorPosition + 1, inputText.length)`
- [x] 2.5 In the `useInput` handler, add `ArrowLeft` branch: decrement cursor to `Math.max(cursorPosition - 1, 0)`
- [x] 2.6 Update single-character insertion to splice at `cursorPosition` instead of appending (preserve existing `input` logic)
- [x] 2.7 Update backspace to delete character at `cursorPosition - 1` (not `inputText.length - 1`), decrement cursor
- [x] 2.8 Pass `cursorPosition` to `InputPanel` component render call

## 3. Write unit tests for inputPanel.js changes

- [x] 3.1 Test `renderBlink` renders highlighted character when `cursorPosition` is within text
- [x] 3.2 Test `renderBlink` does not highlight when `cursorPosition` equals text length
- [x] 3.3 Test `renderBlink` does not highlight when text is empty (no character to highlight)
- [x] 3.4 Test `renderBlink` text segment before cursor is unstyled
- [x] 3.5 Test `renderBlink` text segment after cursor is unstyled
- [x] 3.6 Test `Blink` component forwards `cursorPosition` prop correctly
- [x] 3.7 Test `InputPanel` passes `cursorPosition` to `Blink`
- [x] 3.8 Test that existing blink visibility (even/odd frames) still works with cursor highlighting

## 4. Write tests for cursor navigation in app.js

- [x] 4.1 Test `ArrowRight` increments `cursorPosition` without changing `inputText`
- [x] 4.2 Test `ArrowLeft` decrements `cursorPosition` without changing `inputText`
- [x] 4.3 Test `ArrowRight` at text end does not exceed text length
- [x] 4.4 Test `ArrowLeft` at position zero does not go below zero
- [x] 4.5 Test character insertion at non-end cursor position splices text correctly
- [x] 4.6 Test backspace at non-zero cursor position deletes correct character and decrements cursor
- [x] 4.7 Test Enter-to-send resets `cursorPosition` to end of text
- [x] 4.8 Test normal append behavior is preserved when cursor is at text end

## 5. Run lint and tests

- [x] 5.1 Run `npm run lint` and fix any issues
- [x] 5.2 Run `npm run test` and verify all tests pass
- [x] 5.3 Run `npm run coverage` and verify 100% coverage is maintained
