## Why

The `todo` tool accepts arbitrary Unicode strings for `key` and `content` fields, which introduces inconsistencies in storage, display, and cross-platform compatibility. Unicode characters in todo keys can cause issues with shell scripting, file naming, and terminal rendering. The tool should enforce an ASCII-only constraint to ensure predictable behavior across all environments the agent operates in.

## What Changes

### Agent Behavioral Constraint
- **Agent SHALL only use English** — The agent SHALL only write English text to the `key` and `content` fields when using the `todo` tool. This is the primary prevention layer; the tool-level stripping below is a safety net.

### Technical Implementation
- **Add ASCII-only enforcement for `key` field** — The `key` field SHALL only contain ASCII characters (code points 0-127). Non-ASCII characters are stripped before storage.
- **Add ASCII-only enforcement for `content` field** — The `content` field SHALL only contain ASCII characters. Non-ASCII characters are stripped before storage.
- **Silent stripping, not rejection** — Invalid characters are silently removed rather than returning an error. This preserves the user experience while enforcing the constraint.
- **Update zod schema** — Add `.refine()` or `.transform()` validators to enforce ASCII-only on both `key` and `content` fields.
- **Add tests** — Verify stripping behavior for common Unicode characters (accented letters, CJK, emojis, RTL characters).

## Capabilities

### New Capabilities
- *(none)*

### Modified Capabilities
- `todo-tool`: Adds ASCII-only input enforcement for `key` and `content` fields with silent stripping behavior.

## Impact

- **Affected code**: `src/tools/todo.js` (add ASCII stripping in `todoImpl`), `tests/unit/tool_todos.test.js` (add ASCII stripping tests)
- **API surface**: Non-breaking. The tool still accepts the same fields; behavior changes to silently strip non-ASCII characters.
- **Dependencies**: None external. Only internal tool infrastructure.
