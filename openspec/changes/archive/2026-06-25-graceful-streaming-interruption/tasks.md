## 1. Add intentional abort signaling to TUI

- [ ] 1.1 Add `isIntentionalAbort` ref to `src/tui/app.js` alongside existing refs
- [ ] 1.2 Set `isIntentionalAbort.current = true` in `handleInterrupt()` before calling `abortController.abort()`
- [ ] 1.3 Reset `isIntentionalAbort.current = false` in `handleChat()`'s `finally` block

## 2. Update handleChat() catch block to check abort intent

- [ ] 2.1 Modify `handleChat()`'s catch block to check `isIntentionalAbort.current` before error type detection
- [ ] 2.2 If `isIntentionalAbort.current` is true, execute the clean interruption path regardless of error name
- [ ] 2.3 Preserve existing cleanup logic (tool-call removal, message clearing, flag reset) in the intentional abort path

## 3. Add early abort check in streaming function

- [ ] 3.1 Add early `signal.aborted` check at function entry in `callReactAgentStreaming()` in `src/agent/react.js`
- [ ] 3.2 Throw a named `AbortError` if the signal is already aborted when entering the function
- [ ] 3.3 Preserve existing abort signal check inside the `for await` loop

## 4. Write tests

- [ ] 4.1 Add test for intentional interrupt suppressing error message
- [ ] 4.2 Add test for non-intentional errors still showing error message
- [ ] 4.3 Add test for early abort check throwing named AbortError
- [ ] 4.4 Add test for cleanup behavior during intentional interrupt

## 5. Verify and commit

- [ ] 5.1 Run `npm run test` and verify all tests pass
- [ ] 5.2 Run `npm run lint` and verify no lint errors
- [ ] 5.3 Run `npm start` and verify application starts without crashing
- [ ] 5.4 Manually verify: send message, interrupt during streaming, confirm "Interrupted." status appears