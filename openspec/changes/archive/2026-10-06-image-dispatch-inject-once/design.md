## Context

The `ImageDispatch` middleware (`src/provider/imageDispatchMiddleware.js`) is registered in `createDeepAgent` after summarization and before token-budget. It observes `request.messages` on every `wrapModelCall`, and whenever a `readImage` ToolMessage is present it injects a new multimodal HumanMessage. Because it scans the full message list each call and never tracks which results it has already dispatched, the image is re-attached on every subsequent turn until compaction removes it. It also pairs the image with the most recent HumanMessage text, not the prompt that triggered the `readImage` call. Finally, the `readImage` tool result (`{ ok, mimeType, data }`) is a JSON string in the ToolMessage content, so the base64 payload is sent to the model as plain text tokens on every turn.

## Goals / Non-Goals

**Goals:**
- Inject the image exactly once, on the turn immediately following the `readImage` call.
- Pair the image with the prompt that triggered the `readImage` call.
- Prevent the base64 payload from being sent to the model as plain text tokens.
- Add a regression test covering the two-turn scenario.

**Non-Goals:**
- Changing the `readImage` tool's return shape (the JSON string is still the persisted result; only the middleware strips it before the model sees it).
- Changing `sendImage`'s content-building logic.
- Altering the compaction behavior in `deepAgents.js` (`hasVisionBlock` / `compactAgentContext`).

## Decisions

### Inject once, tracked by `tool_call_id`
A closure-level `Set` of dispatched `tool_call_id`s is maintained per middleware instance. On each `wrapModelCall`, only `readImage` ToolMessages whose `tool_call_id` is not yet in the set are dispatched. This guarantees the image is injected on the turn immediately following the call and never re-attached to unrelated subsequent prompts.

**Alternative considered:** Re-scanning the message list each turn and relying on compaction to eventually remove the image. This was the original behavior and is the bug — it re-attaches on every turn.

### Pair with the triggering prompt
The middleware records, for each `readImage` tool_call_id, the text of the HumanMessage that preceded the AIMessage that made the call. It uses that prompt for the injected text block rather than the most recent HumanMessage.

**Alternative considered:** Using the most recent HumanMessage (original behavior). This pairs the image with the wrong prompt once a later unrelated user message arrives.

### Strip base64 from the ToolMessage content
Rather than mutating the persisted message objects (which `request.messages` shares with the checkpointer), the middleware builds a replacement message list. Each `readImage` ToolMessage is replaced with a stub `ToolMessage` whose content is `"Image read successfully."`. This prevents the base64 from reaching the model as text without corrupting graph state.

**Alternative considered:** Mutating `message.content` in place. Rejected because `request.messages` holds the same object references as the checkpointer, so in-place mutation would alter persisted state.

## Risks / Trade-offs

- [The stub ToolMessage is a new object each call] → It is only used for the model request, not persisted; the original ToolMessage remains in the checkpointer.
- [The `dispatchedToolCallIds` Set is per-middleware-instance] → A fresh orchestrator instance resets the set, which is correct because a new conversation has no prior dispatch history.
- [Multiple `readImage` results in one turn] → All are dispatched in the same injected HumanMessage, each with its own `tool_call_id` tracked in the set.
