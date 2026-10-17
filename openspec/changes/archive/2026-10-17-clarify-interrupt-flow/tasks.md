## 1. Implement the clarify interrupt flow

- [x] 1.1 Modify `clarifyImpl()` in `src/tools/clarify/index.js` to call LangGraph's `interrupt()` with the question and choices, and return the user's answer as the `answer` field
- [x] 1.2 Update the `clarify` tool `description` to note it interrupts the agent to surface the question and captures the user's reply

## 2. Wire interrupt detection and resume in the dispatch path

- [x] 2.1 Add `values` to the stream mode in `callProvider` in `index.js`
- [x] 2.2 Detect `__interrupt__` chunks in the stream loop and surface the question via the streaming callback, then stop the stream
- [x] 2.3 Add `resumeProvider` in `index.js` that re-invokes the graph with `Command({ resume })` on the same thread
- [x] 2.4 Export `resumeProvider` from `index.js`

## 3. Thread resume through the TUI

- [x] 3.1 Pass `resumeProvider` through `App` in `src/tui/app.js` to `ConversationArea`
- [x] 3.2 Handle the `clarify` event in the streaming handler in `src/tui/conversationArea.js` to render the question and arm a pending-clarify state
- [x] 3.3 Route the next user input to `resumeProvider` as the answer when a clarify is pending

## 4. Add test coverage

- [x] 4.1 Update `tests/unit/tools_clarify.test.js` to run `clarifyImpl` inside a graph context
- [x] 4.2 Add tests for the interrupt/resume round-trip and the clarifications file write

## 5. Verify

- [x] 5.1 Run `npm run test` and confirm no regressions
- [x] 5.2 Run `npm run lint` and confirm no lint errors
- [x] 5.3 Run `npm run coverage` and confirm coverage is maintained
