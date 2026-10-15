## Context

The `clarify` tool (`src/tools/clarify/index.js`) is a terminal-based clarification mechanism. `clarifyImpl()` writes the question to `memory/context/clarifications.md` for session context, then returns a JSON string. The current return value is `{ answered: true, answer: "(user_reply_pending)", source: ... }` — it omits the `question` field, so the caller cannot surface what was asked to the user.

The tool is registered in `src/tools/index.js` and used by the agent to ask the user a question. Because the question is not echoed back, the user must ask for it again.

## Goals / Non-Goals

**Goals:**
- Echo the `question` (and `choices` when provided) back in the `clarifyImpl()` return value.
- Update the `clarify` tool `description` to note the question is echoed back.
- Add a test assertion verifying the parsed result includes the `question` field.

**Non-Goals:**
- Changing the clarifications file writing logic or file format.
- Modifying the TUI or any other tool.
- Altering the `answered`, `answer`, or `source` fields (backward compatibility).

## Decisions

- **Include `question` unconditionally.** The `question` is always present in the input schema, so it is always echoed.
- **Include `choices` only when non-empty.** `JSON.stringify` drops `undefined`, but being explicit avoids ambiguity and keeps the output clean when no choices are provided.
- **Preserve existing fields.** `answered`, `answer`, and `source` remain unchanged to avoid breaking any consumers of the current return shape.
- **Update the tool description.** The description currently says it "Stores the question for session context" — it will be updated to note the question is echoed back in the result.

## Risks / Trade-offs

- **Backward compatibility** → The added `question`/`choices` fields are additive; existing consumers that read `answered`/`answer`/`source` are unaffected.
- **Test coverage** → The existing test file asserts only `answered` and `source`; new assertions are added to cover the `question` field, and the `choices` field when provided.
