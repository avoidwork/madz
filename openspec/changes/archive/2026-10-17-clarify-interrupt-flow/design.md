## Context

The `clarify` tool (`src/tools/clarify/index.js`) is a terminal-based clarification mechanism. `clarifyImpl()` writes the question to `memory/context/clarifications.md` for session context, then returns a JSON string. The current return value is `{ answered: true, answer: "(user_reply_pending)", source: ... }` — it never surfaces the question to the user or captures a reply. The user never sees the prompt, yet the tool reports `answered: true`.

The agent is invoked in `index.js` via `agent.stream(input, { streamMode: ["messages", "tools"], subgraphs: true })`. There is no interrupt handling in the stream loop and no resume path. The TUI (`src/tui/`) has no handling for `clarify` — the question is never rendered and there is no input path to capture the user reply.

## Goals / Non-Goals

**Goals:**
- Make the `clarify` tool genuinely pause the agent and surface the question to the user.
- Capture the user's reply and resume the paused agent with it.
- Only report `answered: true` once a real answer is received.
- Preserve the existing clarifications file write for session context.

**Non-Goals:**
- Changing the clarifications file writing logic or file format.
- Adding a new tool or capability beyond the `clarify` tool.
- Implementing a general-purpose human-in-the-loop approval system for arbitrary tools (only the `clarify` tool uses the interrupt).

## Decisions

- **Use LangGraph's `interrupt()` in the tool.** `interrupt()` pauses the graph node and returns the `resume` value when the graph is re-invoked with `Command({ resume })`. It requires a checkpointer, which madz already wires (`createCheckpointer` in `index.js`). This is the idiomatic LangGraph human-in-the-loop mechanism and avoids building a bespoke pause/resume protocol. *Alternative considered:* a custom callback-based pause — rejected because it would not integrate with LangGraph's checkpointing and would require reimplementing state persistence.

- **Add `values` to the stream mode.** The interrupt surfaces as a `values` chunk carrying an `__interrupt__` array. With only `["messages", "tools"]`, the interrupt chunk is silently dropped and the stream just ends. Adding `values` surfaces the `__interrupt__` chunk so the stream loop can detect it. *Alternative considered:* detecting interrupts via a thrown `GraphInterrupt` — rejected because the stream loop consumes the stream and would need try/catch around the whole loop, which is more invasive.

- **Detect `__interrupt__` in the stream loop and break.** When a `values` chunk carries `__interrupt__`, surface the question (and choices) via the streaming callback and `break` out of the loop. The agent is paused; the caller must resume it. This keeps the stream loop simple and avoids consuming a paused stream.

- **Add `resumeProvider`.** A sibling of `callProvider` that re-invokes the graph with `Command({ resume: answer })` on the same thread, streaming the continuation. It reuses the same message/tool/reasoning handling as `callProvider`. *Alternative considered:* folding resume into `callProvider` with a flag — rejected because it would complicate the existing dispatch path and the two flows have different inputs (a message vs. a resume value).

- **Thread `resumeProvider` through the TUI.** `App` receives `resumeProvider` and passes it to `ConversationArea`. When a `clarify` event fires, the streaming handler renders the question as a system message and arms a `pendingClarifyRef`. The next user input is routed to `resumeProvider` as the answer instead of dispatching a new message.

## Risks / Trade-offs

- **Checkpointer required** → `interrupt()` throws if no checkpointer is set. madz always wires one, but a future caller that omits it would break. Mitigation: the tool's `interrupt()` call is the only new dependency on the checkpointer; the existing orchestrator always provides one.

- **Stream mode change** → Adding `values` to the stream mode emits additional chunks. The stream loop already handles `values` (it ignores non-interrupt `values` chunks), so no behavior change for non-interrupt turns.

- **TUI input routing** → When a clarify is pending, the next user input is consumed as the answer. If the user types a slash command instead, it would be treated as an answer. Mitigation: the pending-clarify state is cleared on resume, and the status bar shows "Clarification needed" so the user knows to answer.

- **Nested interrupts** → A resumed agent could fire another `clarify` interrupt. `resumeProvider` handles this by detecting `__interrupt__` again and surfacing it, so multiple sequential clarifications are supported.
