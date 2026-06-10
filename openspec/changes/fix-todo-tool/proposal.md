## Why

The `todo` tool in `src/tools/todo.js` is poorly designed for agent consumption. It returns unstructured string responses, lacks input validation, uses fragile auto-incrementing integer IDs, and has no individual delete capability. The agent must parse text to understand results, cannot reliably distinguish success from failure, and struggles to track IDs across turns. This creates friction in every interaction and undermines the tool's utility as a task management primitive.

## What Changes

- **Restructure all responses to structured JSON** — Every action returns `{ ok: true/false, ... }` with error messages in an `error` field on failure.
- **Replace numeric IDs with string keys** — Actions use a `key` field (e.g., `"fix-login-bug"`) instead of auto-incrementing integers. Keys are semantic, stable, and agent-navigable.
- **Add input validation** — Every action validates required fields before file I/O. Invalid input returns `{ ok: false, error: "..." }` immediately.
- **Simplify `create` API** — Accepts a single `key` + `content` (plus optional `completed`) instead of an array of objects.
- **Add `delete` action** — Removes a single todo by key.
- **Add `list` action** — Returns all todos with optional `filter: "all" | "pending" | "completed"`.
- **Pass runtime options** — `todoImpl` receives `runtimeOptions` via the factory, allowing custom file paths and limits.
- **BREAKING CHANGE**: All existing callers must migrate from `id` (number) to `key` (string). The `create` action no longer accepts a `todos` array.

## Capabilities

### New Capabilities
- `todo-tool`: Redesigned todo tool with structured responses, key-based operations, validation, and new actions (delete, list).

### Modified Capabilities
- *(none — this is a full rewrite, not a delta on existing requirements)*

## Impact

- **Affected code**: `src/tools/todo.js` (full rewrite), `tests/unit/tool_todos.test.js` (full rewrite)
- **API surface**: Breaking change — `id` → `key`, `create` array → single item, response format changes from string to structured JSON
- **Dependencies**: None external. Only internal tool infrastructure (`@langchain/core/tools`, `zod`)
