## Context

The `todo` tool (`src/tools/todo.js`) persists todos to a single JSON file (`memory/tools/todo.json`). It uses auto-incrementing integer IDs, returns plain string responses, and has no input validation. The agent must parse text to understand results and cannot reliably distinguish success from failure. The `memory` tool (`src/tools/memory.js`) demonstrates the correct pattern: structured JSON responses, key-based operations, input validation, and runtime options.

## Goals / Non-Goals

**Goals:**
- Restructure all tool responses to structured JSON with `ok` field
- Replace numeric IDs with semantic string keys
- Add input validation to all actions
- Simplify the `create` API for single-item operations
- Add `delete` and `list` actions
- Pass runtime options through the factory

**Non-Goals:**
- Migrating existing todo data (the file is agent-owned and will be empty)
- Adding due dates, priorities, or nested todos
- Adding a search/filter API beyond simple pending/completed filtering
- Changing the persistence format (still a single JSON file)

## Decisions

### Decision 1: String keys instead of numeric IDs
**Choice:** Use semantic string keys (e.g., `"fix-login-bug"`) instead of auto-incrementing integers.
**Rationale:** Numeric IDs require the agent to track state across turns. Semantic keys are stable, self-documenting, and don't require parsing response strings. The `memory` tool already uses this pattern successfully.
**Alternatives considered:**
- UUIDs — too long, not human-meaningful
- Numeric IDs with full state returned after every operation — still requires parsing, more data transfer

### Decision 2: Structured JSON responses
**Choice:** Every action returns a JavaScript object that LangChain serializes to JSON.
**Rationale:** The agent can inspect the `ok` field to determine success/failure without parsing text. Error messages go in an `error` field. This matches the `memory` tool pattern.
**Alternatives considered:**
- Keep string responses with `ok:` prefix — still requires parsing, less reliable
- Return HTTP-like status codes — overkill for an in-process tool

### Decision 3: Single-item `create` with optional batch
**Choice:** `create` accepts a single `{ key, content, completed? }` object. Batch creation is not supported.
**Rationale:** The agent typically creates one todo at a time. Supporting arrays adds complexity without meaningful benefit. If the agent needs to create multiple, it calls `create` multiple times.
**Alternatives considered:**
- Keep array API — awkward for single items, response only reports new IDs
- Add a separate `createBatch` action — more surface area, agent confusion

### Decision 4: Single JSON file persistence
**Choice:** Keep using `memory/tools/todo.json` as the persistence format.
**Rationale:** Todo lists are small (dozens of items at most). A single file is simpler than per-entry files and avoids directory management. The `memory` tool uses per-entry files because it handles potentially hundreds of entries with metadata.
**Alternatives considered:**
- Per-entry files — overkill for a todo list, adds complexity

### Decision 5: Runtime options via factory
**Choice:** Pass `runtimeOptions` to `todoImpl` through the factory, supporting `filePath` and `maxTodos`.
**Rationale:** Consistent with other tools (`memory`, `sessionSearch`, `clarify`). Allows testing and future customization without changing the impl signature.
**Alternatives considered:**
- Hardcoded file path — prevents testing, no customization
- Environment variable — less flexible, harder to test

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Breaking change for any existing callers | The tool is agent-only; no external callers exist. The file is empty. |
| Key collisions if agent uses same key twice | `create` checks for existing key and returns `{ ok: false, error: "key exists" }`. `update`/`delete`/`complete` return not-found error for missing keys. |
| Loss of ordering information | Todos are stored as an array; order is preserved as added. A `position` field could be added later if needed. |
| No deduplication of keys | The agent is responsible for using unique keys. We could add a `key` uniqueness constraint in validation. |

## Migration Plan

1. Rewrite `src/tools/todo.js` with the new implementation.
2. Rewrite `tests/unit/tool_todos.test.js` to match the new API.
3. Run tests to verify all actions work correctly.
4. No data migration needed — the todo file is agent-owned and typically empty.

## Open Questions

- Should `create` allow an optional `completed` field defaulting to `false`? (Decision: Yes, for consistency with the current API.)
- Should `list` support pagination for large todo lists? (Decision: Not needed — todo lists are small.)
