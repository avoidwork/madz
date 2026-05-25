## 1. Config Schema Extension

- [x] 1.1 Extend SandboxSchema in src/config/schemas.js with `permissions` array and `maxReadSize` string fields
- [x] 1.2 Add zod imports and default values for new sandbox fields
- [x] 1.3 Write unit tests for config schema extension (valid array, invalid types, default values)

## 2. Tools Module Setup

- [x] 2.1 Create src/tools/ directory structure
- [x] 2.2 Create src/tools/common.js with validatePath, validateUrl, and fetchWithTimeout helpers
- [x] 2.3 Write unit tests for src/tools/common.js (path validation positive/negative, URL filter, timeout)

## 3. Filesystem Tools

- [x] 3.1 Create src/tools/filesystem.js — implement read_file tool with line-number format, pagination (offset/limit), maxReadSize check, and similar-filename suggestion on ENOENT
- [x] 3.2 Implement write_file tool with recursive directory creation and content size validation
- [x] 3.3 Implement patch tool with 9 fuzzy matching strategies and unified diff generation
- [x] 3.4 Implement search_files tool with ripgrep primary path and native fs fallback
- [x] 3.5 Write unit tests for filesystem.js (read full/paginated/too-large, write with dirs, patch match/fail scenarios, search with/without ripgrep)

## 4. Terminal Tools

- [x] 4.1 Implement terminal tool using child_process.spawn with sh -c, background mode, and max command length enforcement
- [x] 4.2 Implement process tool with Map-based process tracking supporting list/poll/log/wait/kill/write/pause/resume actions
- [x] 4.3 Write unit tests for terminal.js (foreground execution, background mode, command length limit, process CRUD actions)

## 5. Task Management & Memory Tools

- [x] 5.1 Implement todo tool with read/create/update/complete/clear actions, auto-generated IDs, and file persistence to memory/tools/todo.json
- [x] 5.2 Implement memory tool with key-value entry write, deduplication by key, maxEntries limit, and markdown frontmatter persistence to memory/context/session_memory.md
- [x] 5.3 Implement session_search tool with query-based snippet search, conversationId-based full retrieval, and browse listing
- [x] 5.4 Write unit tests for todo.js, memory.js, and sessionSearch.js (all actions, persistence, edge cases)

## 6. Interaction & Skills Tools

- [x] 6.1 Implement clarify tool with open-ended question support, choices formatting, and context persistence to memory/context/clarifications.md
- [x] 6.2 Implement skills_list tool that wraps SkillRegistry.list() and returns skill summaries
- [x] 6.3 Implement skill_view tool that wraps SkillRegistry.get() and reads the SKILL.md file
- [x] 6.4 Write unit tests for clarify.js, skills.js (clarify question storage, skills list empty/full, skill view found/not-found)

## 7. Tool Registration

- [x] 7.1 Create src/tools/index.js with buildToolConfig(config) function and TOOL_PERMISSIONS map
- [x] 7.2 Implement permission checking logic — register tools only when all required permissions are in config.sandbox.permissions
- [x] 7.3 Ensure clarify (zero-permission tool) always registers
- [x] 7.4 Integrate buildToolConfig into index.js — replace empty tools array with await buildToolConfig(config)
- [x] 7.5 Write unit tests for src/tools/index.js (various permission configs, all tools disabled, all enabled, clarify-only)

## 8. Integration & End-to-End

- [x] 8.1 Update config.yaml with sandbox.permissions and sandbox.maxReadSize example entries
- [x] 8.2 Verify index.js passes tools from buildToolConfig to createReactAgent
- [x] 8.3 Run full test suite (npm run test) and verify all new tests pass
- [x] 8.4 Run lint and format checks (npm run fix + npm run lint)
- [x] 8.5 Run coverage report (npm run coverage) and verify 100% for all new files
