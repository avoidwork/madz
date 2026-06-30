## 1. Config Schema Updates

- [ ] 1.1 Add `loopMsg` field to agent config schema in `src/config/schemas.js`
- [ ] 1.2 Add `loopLimit` field to agent config schema in `src/config/schemas.js` with default value of 5
- [ ] 1.3 Add `loopMsg` and `loopLimit` to `config.yaml` with comments

## 2. Loop Nudge Injection Logic

- [ ] 2.1 Read nudge message from config (`agent.loopMsg`) with default fallback
- [ ] 2.2 Read nudge limit from config (`agent.loopLimit`) with default of 5
- [ ] 2.3 Track nudge count in LangGraph state (add `nudgeCount` field to state)
- [ ] 2.4 In `src/agent/react.js`, when `loop_detected` event is emitted, inject nudge message into conversation if nudge count < limit
- [ ] 2.5 Increment nudge count in state after injecting a nudge
- [ ] 2.6 Ensure nudge message is injected as a `user` message type
- [ ] 2.7 Ensure nudge message does not count as an agent turn in hash tracking

## 3. Session State Management

- [ ] 3.1 Add `nudgeCount` field to the LangGraph state definition
- [ ] 3.2 Ensure `nudgeCount` is reset when the conversation/session is cleared

## 4. Tests

- [ ] 4.1 Add unit test for config schema validation of `loopMsg` and `loopLimit`
- [ ] 4.2 Add unit test for default nudge message when config is not set
- [ ] 4.3 Add unit test for configured nudge message when config is set
- [ ] 4.4 Add unit test for nudge injection when loop is detected and limit not reached
- [ ] 4.5 Add unit test for nudge not injected when limit is reached
- [ ] 4.6 Add unit test for nudge count reset on session clear
- [ ] 4.7 Add unit test for nudge message being a `user` type
- [ ] 4.8 Add unit test for nudge not counting as agent turn

## 5. Verification

- [ ] 5.1 Run `npm run test` and verify all tests pass
- [ ] 5.2 Run `npm run lint` and verify lint passes
- [ ] 5.3 Run `npm run coverage` and verify coverage is maintained
- [ ] 5.4 Verify existing UI nudge ("You're looping.") still works in TUI
- [ ] 5.5 Verify application starts without crashing (`npm start`)