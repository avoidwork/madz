## 1. Enhance handleInterrupt Function

- [ ] 1.1 Enhance handleInterrupt() in app.js to handle non-streaming scenarios (clear input buffer, set interrupted state, clean up session state)
- [ ] 1.2 Add visual feedback mechanism (setInterrupted(true) with 2-second timeout)
- [ ] 1.3 Ensure handleInterrupt resets abort controller and streaming flags

## 2. Modify ESC Key Handler

- [ ] 2.1 Replace handleQuit() call in non-streaming branch with handleInterrupt() in app.js ESC handler
- [ ] 2.2 Preserve onboarding ESC behavior (handleQuit() during profile creation)
- [ ] 2.3 Preserve panel ESC behavior (settings, memory panels)
- [ ] 2.4 Add debounce logic for rapid ESC presses (500ms window)

## 3. Update Input Panel

- [ ] 3.1 Ensure inputPanel.js clears input buffer on interrupt
- [ ] 3.2 Verify no pending input operations remain after interrupt

## 4. Update Session State Management

- [ ] 4.1 Add interrupt() method to stateManager.js if not present (preserve session, clean orphaned state)
- [ ] 4.2 Ensure session state is preserved during interrupt (conversation history, session ID)
- [ ] 4.3 Clean up orphaned tool-call messages and partial assistant messages

## 5. Add Tests

- [ ] 5.1 Write unit tests for handleInterrupt() in various states (streaming, file write, search)
- [ ] 5.2 Write integration tests for ESC key handling in TUI
- [ ] 5.3 Write regression tests for onboarding ESC (still exits) and panel ESC (still exits panel)
- [ ] 5.4 Test rapid ESC presses (no crashes, debounce works)

## 6. Update OpenSpec Documentation

- [ ] 6.1 Verify tasks.md maps to all requirements in tui-esc-interrupt/spec.md
- [ ] 6.2 Verify tasks.md maps to all requirements in streaming-interruption/spec.md
- [ ] 6.3 Update tasks.md with [x] as tasks are completed