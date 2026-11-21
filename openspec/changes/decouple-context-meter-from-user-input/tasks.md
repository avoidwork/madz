# Tasks

## 1. Expose provider-reported input token count

- [ ] 1.1 Add an accessor in `src/provider/contextCalibration.js` that returns the last provider-reported input token count, and verify with a unit test in `tests/unit/provider/contextCalibration.test.js`

## 2. Decouple the meter from user input

- [ ] 2.1 Remove the `updateContextSize` call in `handleChat` (src/tui/conversationArea.js) that appends the just-typed HumanMessage, and verify the meter no longer reacts to user submit
- [ ] 2.2 Replace the live-estimate `debouncedContextUpdate` streaming path with hold-at-last-provider-reported-value behavior, and verify the meter holds during streaming
- [ ] 2.3 Update the meter from the provider-reported input tokens when a real model call completes, and verify the meter reflects the provider-reported value

## 3. Tests

- [ ] 3.1 Extend `tests/unit/tui/conversationArea.test.js` to cover the provider-driven meter and the no-user-input coupling, and verify the tests pass

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
