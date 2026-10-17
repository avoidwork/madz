## Why

The `clarify` tool is a stub that always returns `{ answered: true, answer: "(user_reply_pending)" }` without ever surfacing the question to the user or capturing a reply. The user never sees the prompt, yet the tool reports success it did not earn. The tool needs a real human-in-the-loop interrupt flow so the question reaches the user and their answer is captured.

## What Changes

- `clarifyImpl()` in `src/tools/clarify/index.js` now calls LangGraph's `interrupt()` to pause the agent, carrying the question and choices. The resumed value is the user's answer, so `answered` is only true once a real reply is received.
- `index.js` adds `values` to the stream mode and detects `__interrupt__` chunks, surfacing the question via the streaming callback and stopping the stream. Adds `resumeProvider`, which re-invokes the graph with `Command({ resume })` on the same thread to continue the paused agent.
- `src/tui/app.js` and `src/tui/conversationArea.js` thread `resumeProvider` through the App and ConversationArea. The TUI renders the question as a system message, arms a pending-clarify state, and routes the next user input to `resumeProvider` as the answer.
- `tests/unit/tools_clarify.test.js` is updated to run `clarifyImpl` inside a graph context (required since `interrupt()` needs a checkpointer), covering the interrupt/resume round-trip and the clarifications file write.

## Capabilities

### New Capabilities
<!-- No new capabilities introduced. -->

### Modified Capabilities
- `clarify-tool`: The `clarify` tool now interrupts the agent to surface the question to the user and captures the user's reply, rather than returning a placeholder answer.

## Impact

- `src/tools/clarify/index.js` — `clarifyImpl()` now calls `interrupt()` and returns the user's answer.
- `index.js` — stream mode adds `values`; interrupt detection and `resumeProvider` added.
- `src/tui/app.js`, `src/tui/conversationArea.js` — `resumeProvider` threaded through; pending-clarify state and resume routing added.
- `tests/unit/tools_clarify.test.js` — updated to run within a graph context.

## Non-goals

- Changing the clarifications file writing logic or file format.
- Adding a new tool or capability beyond the `clarify` tool.
- Altering the `answered`, `answer`, or `source` field semantics beyond what the interrupt flow requires.
