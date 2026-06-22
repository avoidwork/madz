## ADDED Requirements

### Requirement: Tool returns structured JSON responses
The tool SHALL return structured JSON objects on every action, not plain strings.
Every response SHALL include an `ok` field: `true` for success, `false` for failure.
On failure, the response SHALL include an `error` field with a human-readable message.

#### Scenario: Successful read returns structured JSON
- **WHEN** the agent calls `todo` with `action: "read"`
- **THEN** the response is `{ ok: true, todos: [...], total: N }`

#### Scenario: Failed update returns error structure
- **WHEN** the agent calls `todo` with `action: "update"`, `key: "nonexistent"`
- **THEN** the response is `{ ok: false, error: "Todo with key 'nonexistent' not found" }`

### Requirement: Key-based operations replace numeric IDs
All actions that reference a specific todo SHALL use a `key` field (string) instead of `id` (number).
The `key` field is semantic and stable across tool invocations (e.g., `"fix-login-bug"`).

#### Scenario: Create uses key instead of id
- **WHEN** the agent calls `todo` with `action: "create"`, `key: "fix-login-bug"`, `content: "Fix the thing"`
- **THEN** the todo is created with the specified key

#### Scenario: Update uses key instead of id
- **WHEN** the agent calls `todo` with `action: "update"`, `key: "fix-login-bug"`, `content: "Updated"`
- **THEN** the todo with key `"fix-login-bug"` is updated

### Requirement: Input validation on all actions
Every action SHALL validate its required fields before performing any file I/O.
Invalid input SHALL return `{ ok: false, error: "..." }` immediately.

#### Scenario: Create requires key and content
- **WHEN** the agent calls `todo` with `action: "create"` but no `key` or `content`
- **THEN** the response is `{ ok: false, error: "create requires: key and content" }`

#### Scenario: Update requires key
- **WHEN** the agent calls `todo` with `action: "update"` but no `key`
- **THEN** the response is `{ ok: false, error: "update requires: key" }`

#### Scenario: Complete requires key
- **WHEN** the agent calls `todo` with `action: "complete"` but no `key`
- **THEN** the response is `{ ok: false, error: "complete requires: key" }`

#### Scenario: Delete requires key
- **WHEN** the agent calls `todo` with `action: "delete"` but no `key`
- **THEN** the response is `{ ok: false, error: "delete requires: key" }`

### Requirement: Create accepts single item
The `create` action SHALL accept a single `{ key, content, completed? }` object, not an array.
If the key already exists, the response SHALL be `{ ok: false, error: "key already exists" }`.

#### Scenario: Create a new todo
- **WHEN** the agent calls `todo` with `action: "create"`, `key: "fix-login-bug"`, `content: "Fix it"`
- **THEN** the response is `{ ok: true, key: "fix-login-bug" }`

#### Scenario: Create with duplicate key fails
- **WHEN** the agent calls `todo` with `action: "create"`, `key: "fix-login-bug"`, `content: "Duplicate"`
- **THEN** the response is `{ ok: false, error: "key 'fix-login-bug' already exists" }`

### Requirement: Delete action removes individual todos
The `delete` action SHALL remove a single todo by key.

#### Scenario: Delete existing todo
- **WHEN** the agent calls `todo` with `action: "delete"`, `key: "fix-login-bug"`
- **THEN** the response is `{ ok: true, key: "fix-login-bug" }`

#### Scenario: Delete non-existing todo
- **WHEN** the agent calls `todo` with `action: "delete"`, `key: "nonexistent"`
- **THEN** the response is `{ ok: false, error: "Todo with key 'nonexistent' not found" }`

### Requirement: List action with filtering
The `list` action SHALL return all todos, optionally filtered by status.

#### Scenario: List all todos
- **WHEN** the agent calls `todo` with `action: "list"`
- **THEN** the response is `{ ok: true, todos: [...], total: N }`

#### Scenario: List pending todos
- **WHEN** the agent calls `todo` with `action: "list"`, `filter: "pending"`
- **THEN** the response includes only todos where `completed` is `false`

#### Scenario: List completed todos
- **WHEN** the agent calls `todo` with `action: "list"`, `filter: "completed"`
- **THEN** the response includes only todos where `completed` is `true`

### Requirement: Runtime options support
The tool SHALL accept `runtimeOptions` via the factory function, supporting:
- `filePath`: Custom path for the todo JSON file (default: `"memory/tools/todo.json"`)
- `maxTodos`: Maximum number of todos allowed (optional, no default limit)

#### Scenario: Custom file path
- **WHEN** the factory is called with `{ filePath: "custom/path.json" }`
- **THEN** todos are persisted to `custom/path.json`

#### Scenario: Max todos enforced
- **WHEN** `maxTodos` is set to 10 and the agent tries to create the 11th todo
- **THEN** the response is `{ ok: false, error: "max todos (10) reached" }`

### Requirement: Complete action marks todo as done
The `complete` action SHALL set `completed: true` on a todo by key.

#### Scenario: Complete existing todo
- **WHEN** the agent calls `todo` with `action: "complete"`, `key: "fix-login-bug"`
- **THEN** the response is `{ ok: true, key: "fix-login-bug" }`
- **AND** the todo's `completed` field is `true`

#### Scenario: Complete non-existing todo
- **WHEN** the agent calls `todo` with `action: "complete"`, `key: "nonexistent"`
- **THEN** the response is `{ ok: false, error: "Todo with key 'nonexistent' not found" }`

### Requirement: Clear action removes all todos
The `clear` action SHALL remove all todos from the file.

#### Scenario: Clear all todos
- **WHEN** the agent calls `todo` with `action: "clear"`
- **THEN** the response is `{ ok: true }`
- **AND** subsequent `read` returns `{ ok: true, todos: [], total: 0 }`

### Requirement: Unknown action returns error
The tool SHALL return `{ ok: false, error: "Unknown action: '...'" }` for any unrecognized action.

#### Scenario: Unknown action
- **WHEN** the agent calls `todo` with `action: "foobar"`
- **THEN** the response is `{ ok: false, error: "Unknown action: 'foobar'. Valid actions: read, create, update, complete, delete, list, clear" }`
