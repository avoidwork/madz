## 1. Add interruption state tracking

- [ ] 1.1 Add `isInterrupting` boolean flag to TUI app state in src/tui/app.js
- [ ] 1.2 Initialize `isInterrupting` to false on app startup

## 2. Modify handleInterrupt() to set state and reset conversation

- [ ] 2.1 Set `isInterrupting = true` at the start of handleInterrupt()
- [ ] 2.2 Ensure abort controller is signaled before setting the flag
- [ ] 2.3 Reset conversation state to valid configuration (system message first) after abort completes
- [ ] 2.4 Set `isInterrupting = false` after the dispatch promise resolves

## 3. Modify error handling to catch interruption errors

- [ ] 3.1 In the try/catch around dispatchProvider calls, check `isInterrupting` flag
- [ ] 3.2 If `isInterrupting` is true and an error occurs, handle it gracefully (log and clear error state)
- [ ] 3.3 If `isInterrupting` is false, handle the error according to existing logic

## 4. Add safety net in OpenAI provider

- [ ] 4.1 In src/provider/openai.js, add a guard that ensures system message is first in the conversation array before making API calls
- [ ] 4.2 If the system message is not first, reorder messages to fix the ordering
- [ ] 4.3 Log a warning when message reordering occurs

## 5. Update tui-conversation spec

- [ ] 5.1 Verify the spec delta in openspec/changes/fix-tool-interruption-400-error/specs/tui-conversation/spec.md is correct
- [ ] 5.2 Ensure all requirements have corresponding scenarios

## 6. Test the fix

- [ ] 6.1 Test interrupting a tool execution and verify no 400 error occurs
- [ ] 6.2 Test that the conversation continues normally after interruption
- [ ] 6.3 Test that normal errors (non-interruption) are still displayed correctly
- [ ] 6.4 Test rapid successive interruptions to verify no race conditions

## 7. Run verification

- [ ] 7.1 Run npm run test and verify all tests pass
- [ ] 7.2 Run npm run lint and verify no lint errors
- [ ] 7.3 Run npm run coverage and verify coverage is maintained
- [ ] 7.4 Run npm start and verify the application starts without crashing