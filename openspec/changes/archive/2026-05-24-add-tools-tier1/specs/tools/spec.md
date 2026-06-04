## ADDED Requirements

### Requirement: Tool Definitions Are LangChain-Native
Every tool SHALL be defined as an async function decorated with LangChain's `@tool` export from `@langchain/core/tools`, taking a zod schema for input validation and providing a `name` and `description` for LLM discovery.

#### Scenario: Tool is decorated with @tool
- **WHEN** a tool module exports a `tool(...)` decorated function
- **THEN** the tool has a `name` string, a `description` string visible to the LLM, and a zod schema for input validation

#### Scenario: Invalid tool input is rejected
- **WHEN** a tool is called with arguments that do not match the zod schema
- **THEN** the tool returns an error message describing the validation failure instead of executing

### Requirement: Tool Registration Is Permission-Gated
The `buildToolConfig` function SHALL inspect `config.sandbox.permissions` and only return tools whose required permissions are all included in the enabled set. A tool with no permission requirements (e.g., `clarify`) is always registered.

#### Scenario: Filesystem read tools register when permission enabled
- **WHEN** `sandbox.permissions` includes `filesystem:read`
- **THEN** `read_file` and `search_files` are included in the returned tools array

#### Scenario: Filesystem write tools register only with write permission
- **WHEN** `sandbox.permissions` includes `filesystem:write`
- **THEN** `write_file` and `patch` are included in the returned tools array

#### Scenario: Terminal tools require both exec and spawn permissions
- **WHEN** `sandbox.permissions` includes both `filesystem:exec` and `process:spawn`
- **THEN** `terminal` and `process` are included; if only one is present, neither is registered

#### Scenario: Clarify tool registers with no permissions
- **WHEN** `sandbox.permissions` is an empty array
- **THEN** `clarify` is still registered because it has no permission requirement

### Requirement: File Path Validation Uses Sandbox Resolver
All tools that accept a file path MUST resolve the path through `src/sandbox/pathResolver.js` and reject paths outside allowed sandbox directories.

#### Scenario: Tool reads a file within sandbox paths
- **WHEN** `read_file` is called with `"src/tools/index.js"` and `sandbox.paths` includes the project directory
- **THEN** the file content is returned formatted as `LINE_NUM|CONTENT`

#### Scenario: Tool rejects a path outside sandbox
- **WHEN** `read_file` is called with `/etc/passwd` and it is not in `sandbox.paths`
- **THEN** the tool returns an error message indicating the path is not in the allowed scope

#### Scenario: Tool suggests similar filenames on ENOENT
- **WHEN** `read_file` is called with a non-existent path like `"src/tool.js"` and `src/tools/index.js` exists
- **THEN** the response includes a suggestion for similar filenames

### Requirement: File Read Supports Pagination
The `read_file` tool SHALL support `offset` and `limit` parameters for large files, returning a slice of the line array.

#### Scenario: Read entire file without offset/limit
- **WHEN** `read_file` is called with just a `path` argument (no offset, no limit)
- **THEN** all lines are returned in `LINE_NUM|CONTENT` format

#### Scenario: Read file with offset and limit
- **WHEN** `read_file` is called with `path`, `offset: 100`, and `limit: 50`
- **THEN** only lines 100 through 149 are returned

#### Scenario: Read exceeds max file size
- **WHEN** `read_file` is called with a file exceeding `sandbox.maxReadSize` (default 1MB)
- **THEN** the tool returns an error suggesting the user provide `limit` to paginate

### Requirement: File Write Creates Parent Directories
The `write_file` tool SHALL create all parent directories recursively if they do not exist, then write the content atomically.

#### Scenario: Write creates missing directories
- **WHEN** `write_file` is called with `path: "memory/nested/deep/file.txt"` and the directories do not exist
- **THEN** all parent directories are created and the file is written

#### Scenario: Write exceeds max content size
- **WHEN** `write_file` is called with content exceeding 500KB
- **THEN** the tool returns an error indicating the content is too large

### Requirement: Patch Applies Fuzzy Find-and-Replace
The `patch` tool SHALL attempt up to 9 fuzzy matching strategies to find `oldStr` in the file, replace it with `newStr`, and return a unified diff.

#### Scenario: Patch succeeds with exact match
- **WHEN** `patch` is called and `oldStr` matches a line exactly in the file
- **THEN** the file is updated, a unified diff is returned, and `numChanges` is 1

#### Scenario: Patch succeeds with whitespace-insensitive match
- **WHEN** `oldStr` has different leading/trailing whitespace than the file content
- **THEN** the 9th fuzzy strategy matches it, the file is updated, and the diff is returned

#### Scenario: Patch fails when no match found
- **WHEN** none of the 9 fuzzy strategies find `oldStr` in the file
- **THEN** the tool returns an error with suggestions (e.g., close matches in the file)

### Requirement: File Search Supports Ripgrep and Fallback
The `search_files` tool SHALL attempt to use the `rg` (ripgrep) binary first, then fall back to native `fs` + regex search if ripgrep is unavailable.

#### Scenario: Search uses ripgrep when available
- **WHEN** `rg` is installed on the system and `search_files` is called with `target: "content"`
- **THEN** the tool invokes `rg` with the provided pattern and returns results

#### Scenario: Search falls back to native implementation
- **WHEN** `rg` is not installed and `search_files` is called
- **THEN** the tool uses native `fs` readdir + regex line-by-line matching as a fallback

#### Scenario: Search respects maxResults limit
- **WHEN** `search_files` is called with `maxResults: 5`
- **THEN** no more than 5 matches are returned in the `matches` array

### Requirement: Terminal Executes Commands With Timeout
The `terminal` tool SHALL execute shell commands via `child_process.spawn` with `sh -c`, enforce a configurable timeout, support background mode, and capture stdout/stderr streams.

#### Scenario: Terminal runs a foreground command
- **WHEN** `terminal` is called with `command: "echo hello"` and `background: false`
- **THEN** the command runs, outputs are captured, and the tool returns `{ stdout: "hello\n", exitCode: 0, running: false }`

#### Scenario: Terminal runs a background process
- **WHEN** `terminal` is called with `command: "sleep 10"` and `background: true`
- **THEN** the command starts in the background and the tool returns `{ running: true, processId: <number> }`

#### Scenario: Terminal enforces max command length
- **WHEN** `terminal` is called with a command exceeding 4096 characters
- **THEN** the tool returns an error without executing the command

#### Scenario: Terminal executes via allowed shells only
- **WHEN** `terminal` is called with a command
- **THEN** the command is executed via `sh -c` (whitelisted shell interpreter)

### Requirement: Process Manages Background Processes
The `process` tool SHALL maintain a `Map<number, ProcessEntry>` of background processes and support actions: `list`, `poll`, `log`, `wait`, `kill`, `write`, `pause`, `resume`.

#### Scenario: List shows active processes
- **WHEN** `process` is called with `action: "list"`
- **THEN** it returns an array of `{ pid, command, status, uptime }` for each managed process

#### Scenario: Kill terminates a process
- **WHEN** `process` is called with `action: "kill"` and a `processId`
- **THEN** the process receives SIGTERM, and SIGKILL after the grace period, and is removed from the map

#### Scenario: Write sends data to process stdin
- **WHEN** `process` is called with `action: "write"`, a `processId`, and `data: "input\n"`
- **THEN** the data is written to the process's stdin stream

### Requirement: Todo List Persists To File System
The `todo` tool SHALL persist the todo list to `memory/tools/todo.json`, support `read`, `create`, `update`, `complete`, and `clear` actions, and auto-generate incrementing integer IDs.

#### Scenario: Read returns current todo list
- **WHEN** `todo` is called with `action: "read"` and no `todos` array
- **THEN** it loads `memory/tools/todo.json` (or returns empty list if file does not exist)

#### Scenario: Create adds items with auto-generated IDs
- **WHEN** `todo` is called with `action: "create"` and `todos: [{ content: "Fix login bug" }]` (no id)
- **THEN** it assigns the next incrementing integer ID and persists the updated list

#### Scenario: Clear writes an empty list
- **WHEN** `todo` is called with `action: "clear"`
- **THEN** it writes `[]` to the todo file

### Requirement: Memory Saves Entries To Session Memory File
The `memory` tool SHALL write key-value entries to `memory/context/session_memory.md` in markdown frontmatter format, deduplicating keys within the current session and limiting total entries to `memory.maxEntries` (default 100).

#### Scenario: Entry is written to session memory
- **WHEN** `memory` is called with `entries: [{ key: "user_pref", value: "dark_mode" }]`
- **THEN** the entry is written to `memory/context/session_memory.md` and the response includes `{ saved: 1, keys: ["user_pref"] }`

#### Scenario: Duplicate key overwrites existing entry
- **WHEN** `memory` is called with `entries: [{ key: "user_pref", value: "light_mode" }]` after a prior entry with the same key
- **THEN** the file is updated and the response returns `{ saved: 1, keys: ["user_pref"] }`

### Requirement: Session Search Retrieves Past Conversations
The `session_search` tool SHALL scan `memory/sessions/` for `.md` conversation files, support query-based search returning matching snippets, and support `conversationId` for retrieving full conversation text.

#### Scenario: Search finds conversations matching a query
- **WHEN** `session_search` is called with `query: "authentication"` and `limit: 10`
- **THEN** it returns matching snippets (±2 message context) from conversation files, truncated to `limit` results

#### Scenario: Retrieve full conversation
- **WHEN** `session_search` is called with `conversationId: "abc123"`
- **THEN** it returns the full conversation text for that ID

#### Scenario: Browse lists available conversations
- **WHEN** `session_search` is called with no `query` and no `conversationId`
- **THEN** it returns a list of available conversations with date and first-message preview

### Requirement: Clarify Prompts The User For Input
The `clarify` tool SHALL return a question prompt with optional `choices` that the TUI displays to the user. The answer is returned on the next agent interaction as conversation history.

#### Scenario: Clarify with open-ended question
- **WHEN** `clarify` is called with `question: "Should I use TypeScript for this project?"` and no choices
- **THEN** the tool returns `{ answered: true, answer: "<user_reply>", source: "open_ended" }`

#### Scenario: Clarify with choices formats as numbered list
- **WHEN** `clarify` is called with `question: "Which framework?"` and `choices: ["React", "Vue", "Svelte"]`
- **THEN** the tool formats the choices as a numbered list for the TUI to display

#### Scenario: Clarify question is stored for context
- **WHEN** `clarify` is called
- **THEN** the question is appended to `memory/context/clarifications.md` for session context

### Requirement: Skills List Reuses SkillRegistry
The `skills_list` tool SHALL call `SkillRegistry.list()` and return each skill's name, version, description, and permissions array.

#### Scenario: List returns all discovered skills
- **WHEN** `skills_list` is called
- **THEN** it returns `{ skills: [...], count: N }` where each skill has name, version, description, and permissions

#### Scenario: List returns empty when registry has no skills
- **WHEN** `skills_list` is called and no skills are discovered
- **THEN** it returns `{ skills: [], count: 0 }` with a message suggesting running discovery

### Requirement: Skill View Returns Full SKILL.md Content
The `skill_view` tool SHALL look up a skill by name via `SkillRegistry.get(name)`, read the `SKILL.md` file, and return the complete metadata along with any linked scripts.

#### Scenario: View returns skill details
- **WHEN** `skill_view` is called with `name: "code-review"`
- **THEN** it returns the skill's name, version, description, inputSchema, outputSchema, permissions, scripts, and full SKILL.md content

#### Scenario: View returns error for unknown skill
- **WHEN** `skill_view` is called with a name not found in the registry
- **THEN** it returns an error message indicating the skill was not discovered

## MODIFIED Requirements

### Requirement: Configuration Validation (from config-system)
**The system SHALL validate `sandbox.permissions` as a string array and `sandbox.maxReadSize` as a string, accepting values like `"1mb"` or `"1024"` (bytes).**

#### Scenario: Sandbox permissions array is validated
- **WHEN** `config.yaml` includes `sandbox.permissions: [filesystem:read, filesystem:write, process:spawn]`
- **THEN** the system validates it as a string array and stores it for tool registration use

#### Scenario: Sandbox maxReadSize is validated
- **WHEN** `config.yaml` includes `sandbox.maxReadSize: "2mb"`
- **THEN** the system validates the string and stores it as the maximum allowed file read size

## ADDED Requirements

### Requirement: Sandbox Schema Extension
The sandbox zod schema in `src/config/schemas.js` SHALL include `permissions: z.array(z.string()).default([])` and `maxReadSize: z.string().default("1mb")`.

#### Scenario: Schema accepts permissions array
- **WHEN** config includes `permissions: ["filesystem:read"]`
- **THEN** the zod schema validates and accepts it

#### Scenario: Schema defaults permissions to empty array
- **WHEN** `sandbox.permissions` is omitted from config
- **THEN** the schema defaults to `[]`

#### Scenario: Schema defaults maxReadSize to 1mb
- **WHEN** `sandbox.maxReadSize` is omitted from config
- **THEN** the schema defaults to `"1mb"`

### Requirement: Common Tool Utilities
The `src/tools/common.js` module SHALL export `validatePath` (against sandbox allowlist), `validateUrl` (against URL filter), and `fetchWithTimeout` (HTTP GET with configurable timeout and URL validation).

#### Scenario: validatePath rejects paths outside sandbox
- **WHEN** `validatePath("/etc/passwd", ["memory/", "src/"])` is called
- **THEN** it throws an error indicating the path is not within allowed sandbox paths

#### Scenario: validateUrl blocks file:// scheme
- **WHEN** `validateUrl("file:///etc/passwd")` is called
- **THEN** it returns `{ allowed: false, reason: "scheme file:// is blocked" }`

#### Scenario: fetchWithTimeout enforces timeout
- **WHEN** `fetchWithTimeout("https://example.com/slow", 1000)` is called and the server responds after 2 seconds
- **THEN** the fetch rejects with a timeout error after 1 second
