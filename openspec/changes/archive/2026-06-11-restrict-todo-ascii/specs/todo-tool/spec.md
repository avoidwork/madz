## ADDED Requirements

### Requirement: Agent SHALL only use English for todo entries
When using the `todo` tool, the agent SHALL only write English text to the `key` and `content` fields.
This prevents unexpected multi-language content from appearing in stored todos.
Non-ASCII characters in the agent's output are silently stripped by the tool as a safety net.

#### Scenario: Agent writes English-only content
- **WHEN** the agent calls `todo` with `action: "create"`, `key: "fix-login-bug"`, `content: "Fix authentication timeout"`
- **THEN** the todo is stored with the provided key and content unchanged

#### Scenario: Agent accidentally includes non-English text (safety net)
- **WHEN** the agent calls `todo` with `action: "create"`, `key: "møde-i morgen"`, `content: "Discuss Q3 roadmap"`
- **THEN** the tool strips non-ASCII from the key, storing `"m-de-i morgen"`, while content passes through unchanged

### Requirement: Key field accepts only ASCII characters
The `key` field SHALL only contain ASCII characters (Unicode code points 0–127).
Any non-ASCII characters in the provided key are silently stripped before storage.

#### Scenario: Key with accented characters is stripped
- **WHEN** the agent calls `todo` with `action: "create"`, `key: "fix-café-bug"`, `content: "Fix it"`
- **THEN** the todo is stored with key `"fix-cafe-bug"`

#### Scenario: Key with emoji is stripped
- **WHEN** the agent calls `todo` with `action: "create"`, `key: "fix-🐛-bug"`, `content: "Fix it"`
- **THEN** the todo is stored with key `"fix--bug"`

#### Scenario: Key with CJK characters is stripped
- **WHEN** the agent calls `todo` with `action: "create"`, `key: "修复-bug"`, `content: "Fix it"`
- **THEN** the todo is stored with key `"-bug"`

#### Scenario: ASCII-only key passes through unchanged
- **WHEN** the agent calls `todo` with `action: "create"`, `key: "fix-login-bug"`, `content: "Fix it"`
- **THEN** the todo is stored with key `"fix-login-bug"`

### Requirement: Content field accepts only ASCII characters
The `content` field SHALL only contain ASCII characters (Unicode code points 0–127).
Any non-ASCII characters in the provided content are silently stripped before storage.

#### Scenario: Content with accented characters is stripped
- **WHEN** the agent calls `todo` with `action: "create"`, `key: "notes"`, `content: "Meet at café tomorrow"`
- **THEN** the todo is stored with content `"Meet at cafe tomorrow"`

#### Scenario: Content with emoji is stripped
- **WHEN** the agent calls `todo` with `action: "create"`, `key: "notes"`, `content: "Buy 🥑 and 🍞"`
- **THEN** the todo is stored with content `"Buy  and "`

#### Scenario: Content with RTL characters is stripped
- **WHEN** the agent calls `todo` with `action: "create"`, `key: "notes"`, `content: "مرحبا world"`
- **THEN** the todo is stored with content `" world"`

#### Scenario: ASCII-only content passes through unchanged
- **WHEN** the agent calls `todo` with `action: "create"`, `key: "notes"`, `content: "Buy milk and eggs"`
- **THEN** the todo is stored with content `"Buy milk and eggs"`

#### Scenario: Update with non-ASCII content strips characters
- **WHEN** the agent calls `todo` with `action: "update"`, `key: "notes"`, `content: "Updated: meet at über café"`
- **THEN** the todo content is updated to `"Updated: meet at uber cafe"`
