## 1. Decouple counting from display in index.js

- [x] 1.1 In `callProvider`, emit a dedicated `tool_message` event carrying the ToolMessage text regardless of `showToolResults`, before the `continue` so the TUI can count it.

## 2. Add tool-message token ref in conversationArea.js

- [x] 2.1 Introduce `toolMessageTokensRef` alongside `tokenCacheRef`.
- [x] 2.2 In the streaming handler, on `tool_message` events, compute the token count for the tool text via `model.getNumTokensFromMessages` and accumulate it.

## 3. Include tool tokens in the streaming count

- [x] 3.1 In `debouncedContextUpdate`, change the update to `onContextUpdate(preStreamContextSize + cached.tokens + toolMessageTokensRef.current)`.

## 4. Reset the tool-message ref per turn

- [x] 4.1 Clear `toolMessageTokensRef.current` at the start of `handleChat`.

## 5. Add tests

- [x] 5.1 Add/extend `tests/unit/tui/conversationArea.test.js` covering: (a) a `tool_message` event increments the context counter, (b) `showToolResults: false` still emits the `tool_message` event for counting, (c) the displayed message text is not polluted by tool content.

## 6. Verify

- [x] 6.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm no regressions.
