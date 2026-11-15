# Tasks

## 1. Stream consumer event tracking

- [x] 1.1 In `consumeStream` (`index.js`), add a `let lastEventType = null;` accumulator, set it on every `streamingCallback` call for non-subagent events (`message`, `reasoning`, `tool`, `on_tool_start`, `on_tool_end`), and return it in the result object. Verify with a new `tests/unit/stream/consume.test.js` covering message-only, reasoning-only, reasoning-then-message, and tool-then-reasoning sequences.
- [x] 1.2 Thread `lastEventType` through `runAgent`, `callProvider`, and `dispatchProvider` so the resolved response carries it. Verify the existing provider tests still pass and that `dispatchProvider` resolves with `lastEventType`.

## 2. Message list last-ID accessor

- [x] 2.1 Add `getLastMessageId()` to the `messageList.js` imperative API returning `idsRef.current[idsRef.current.length - 1]` (or `undefined` when empty). Verify with tests in `tests/unit/tui/messageList.test.js` for non-empty and empty lists.

## 3. Config loop guard

- [x] 3.1 Add `autoContinueLimit: z.number().int().positive().default(1000)` to `AgentSchema` (`src/config/schemas/agent.js`). Verify the schema test in `tests/unit/config/schemas/agent.test.js` passes and the default is 1000.
- [x] 3.2 Add `autoContinueLimit: 1000` under `agent:` in `config.yaml`. Verify `npm run test` for config loading passes.

## 4. TUI auto-continue dispatch

- [x] 4.1 In `runTurn` (`conversationArea.js`), after `finalizeStreaming`, dispatch `handleChat("Continue", { silentUser: true })` only when `response.lastEventType === "reasoning"` AND `streamingMsgIdRef.current === messageListRef.current.getLastMessageId()` AND the loop guard (`autoContinueCountRef` / `config.agent.autoContinueLimit`) is not exhausted. Verify with an extended `tests/unit/tui/conversationArea.test.js` covering the reasoning-only + last-bubble dispatch and the non-trigger cases (subagent reasoning, tool-then-reasoning, non-last bubble, loop-guard exhaustion).

## 5. Verification

- [x] 5.1 Run `npm run test`, `npm run lint`, and `npm run coverage` and verify all pass with no regressions.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
