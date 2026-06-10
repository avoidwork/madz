## 1. Rewrite core implementation

- [x] 1.1 Replace `loadTodos`/`saveTodos` helpers to use configurable `filePath` from runtimeOptions
- [x] 1.2 Add `findTodoByKey` helper that returns `{ found, todo }` structure
- [x] 1.3 Add `validateRequired(input, fields)` helper for consistent field validation
- [x] 1.4 Rewrite `todoImpl` switch statement: `read` returns `{ ok: true, todos, total }`
- [x] 1.5 Rewrite `create` action: accepts single `{ key, content, completed? }`, validates, checks duplicate key, returns `{ ok: true, key }`
- [x] 1.6 Rewrite `update` action: validates key, finds by key, updates content/completed, returns `{ ok: true, key }` or error
- [x] 1.7 Rewrite `complete` action: validates key, finds by key, sets completed=true, returns `{ ok: true, key }` or error
- [x] 1.8 Add `delete` action: validates key, finds by key, removes from array, saves, returns `{ ok: true, key }` or error
- [x] 1.9 Add `list` action: returns all todos with optional `filter: "pending" | "completed"`
- [x] 1.10 Rewrite `clear` action: returns `{ ok: true }` after clearing
- [x] 1.11 Add unknown action handling with valid action list in error message

## 2. Update Zod schema

- [x] 2.1 Replace `id: z.number()` with `key: z.string()` in schema
- [x] 2.2 Replace `todos: z.array(...)` with single-item `key`, `content`, `completed` fields
- [x] 2.3 Add `filter: z.enum(["all", "pending", "completed"]).optional()` for list action
- [x] 2.4 Ensure all optional fields are correctly marked (e.g., `completed` optional in create)

## 3. Update factory function

- [x] 3.1 Update `createTodoTool` to pass `runtimeOptions` to `todoImpl` as second argument
- [x] 3.2 Support `filePath` and `maxTodos` from runtimeOptions in the factory
- [x] 3.3 Remove duplicate standalone `todo` export (or keep as deprecated alias)

## 4. Update index.js wiring

- [x] 4.1 Verify `TOOL_PERMISSIONS.todo` still lists `["filesystem:read", "filesystem:write"]`
- [x] 4.2 Verify `TOOL_FACTORIES.todo` points to `createTodoTool`
- [x] 4.3 Ensure `buildToolConfig` passes runtime options correctly (already does for default case)

## 5. Rewrite tests

- [x] 5.1 Update test setup to use configurable temp directory
- [x] 5.2 Rewrite `read` test: verify structured JSON response with `ok: true`, `todos`, `total`
- [x] 5.3 Rewrite `create` tests: single item, duplicate key rejection, with/without completed
- [x] 5.4 Rewrite `update` tests: by key, missing key error, partial update (content only, completed only)
- [x] 5.5 Add `complete` tests: existing key, missing key error
- [x] 5.6 Add `delete` tests: existing key, missing key error
- [x] 5.7 Add `list` tests: all, pending filter, completed filter
- [x] 5.8 Add `clear` test: verify empty state after clear
- [x] 5.9 Add validation tests: create without key/content, update without key, etc.
- [x] 5.10 Add unknown action test
- [x] 5.11 Run full test suite and verify all pass

## 6. Final verification

- [x] 6.1 Verify the tool file has no lint errors
- [x] 6.2 Verify the test file has no lint errors
- [x] 6.3 Run `npm test` for the full test suite
- [x] 6.4 Verify `memory/tools/todo.json` is reset to empty state after tests
