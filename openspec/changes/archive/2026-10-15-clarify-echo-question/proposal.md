## Why

The `clarify` tool stores the clarification question to `memory/context/clarifications.md` but does not echo the question back in its return value. The tool returns `{"answered": true, "answer": "(user_reply_pending)", "source": "open_ended"}` — omitting the `question` field entirely. As a result, the user never sees what was asked and must ask for the question again.

## What Changes

- `clarifyImpl()` in `src/tools/clarify/index.js` now includes the `question` field in its JSON return value.
- When `choices` are provided, the return value also includes the `choices` array.
- The `clarify` tool `description` is updated to note the question is echoed back in the result.
- A test assertion is added in `tests/unit/tools_clarify.test.js` verifying the parsed result includes the `question` field.

## Capabilities

### New Capabilities
- `clarify-tool`: The `clarify` tool's behavior — it stores a clarification question to session context and echoes the question (and any choices) back in its return value so the user sees what was asked.

### Modified Capabilities
<!-- No existing spec-level behavior changes. -->

## Impact

- `src/tools/clarify/index.js` — `clarifyImpl()` return object and `clarify` tool description.
- `tests/unit/tools_clarify.test.js` — new assertions for the `question` field.
- No changes to the clarifications file writing logic, TUI, or other tools.
