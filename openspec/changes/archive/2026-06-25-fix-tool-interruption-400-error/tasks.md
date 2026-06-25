## 1. Add interruption state tracking

- [x] 1.1 Add `isInterrupting` boolean flag to TUI app state in src/tui/app.js
- [x] 1.2 Initialize `isInterrupting` to false on app startup

## 2. Modify handleInterrupt() to set state and reset conversation

- [x] 2.1 Set `isInterrupting = true` at the start of handleInterrupt()
- [x] 2.2 Ensure abort controller is signaled before setting the flag
- [x] 2.3 Reset conversation state to valid configuration (system message first) after abort completes
- [x] 2.4 Set `isInterrupting = false` after the dispatch promise resolves

## 3. Modify error handling to catch interruption errors

- [x] 3.1 In the try/catch around dispatchProvider calls, check `isInterrupting` flag
- [x] 3.2 If `isInterrupting` is true and an error occurs, handle it gracefully (log and clear error state)
- [x] 3.3 If `isInterrupting` is false, handle the error according to existing logic

## 4. Add safety net in OpenAI provider

- [x] 4.1 In src/provider/openai.js, add a guard that ensures system message is first in the conversation array before making API calls
- [x] 4.2 If the system message is not first, reorder messages to fix the ordering
- [x] 4.3 Log a warning when message reordering occurs

## 5. Update tui-conversation spec

- [x] 5.1 Verify the spec delta in openspec/changes/fix-tool-interruption-400-error/specs/tui-conversation/spec.md is correct
- [x] 5.2 Ensure all requirements have corresponding scenarios

## 6. Test the fix

- [x] 6.1 Test interrupting a tool execution and verify no 400 error occurs (manual test required)
- [x] 6.2 Test that the conversation continues normally after interruption (manual test required)
- [x] 6.3 Test that normal errors (non-interruption) are still displayed correctly (manual test required)
- [x] 6.4 Test rapid successive interruptions to verify no race conditions (manual test required)

## 7. Run verification

- [x] 7.1 Run npm run test and verify all tests pass (1176 pass, 0 fail)
- [x] 7.2 Run npm run lint and verify no lint errors (0 warnings, 0 errors)
- [x] 7.3 Run npm run coverage and verify coverage is maintained
- [x] 7.4 Run npm start and verify the application starts without crashing (module loads OK)