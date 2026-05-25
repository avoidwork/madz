## 1. Config Schema Extension

- [ ] 1.1 Extend SandboxSchema in src/config/schemas.js with `permissions` array and `maxReadSize` string fields
- [ ] 1.2 Add zod imports and default values for new sandbox fields
- [ ] 1.3 Write unit tests for config schema extension (valid array, invalid types, default values)

## 2. Tools Module Setup

- [ ] 2.1 Create src/tools/ directory structure
- [ ] 2.2 Create src/tools/common.js with validatePath, validateUrl, and fetchWithTimeout helpers
- [ ] 2.3 Write unit tests for src/tools/common.js (path validation positive/negative, URL filter, timeout)

## 3. Filesystem Tools

- [ ] 3.1 Create src/tools/filesystem.js — implement read_file tool with line-number format, pagination (offset/limit), maxReadSize check, and similar-filename suggestion on ENOENT
- [ ] 3.2 Implement write_file tool with recursive directory creation and content size validation
- [ ] 3.3 Implement patch tool with 9 fuzzy matching strategies and unified diff generation
- [ ] 3.4 Implement search_files tool with ripgrep primary path and native fs fallback
- [ ] 3.5 Write unit tests for filesystem.js (read full/paginated/too-large, write with dirs, patch match/fail scenarios, search with/without ripgrep)

## 4. Terminal Tools

- [ ] 4.1 Implement terminal tool using child_process.spawn with sh -c, background mode, and max command length enforcement
- [ ] 4.2 Implement process tool with Map-based process tracking supporting list/poll/log/wait/kill/write/pause/resume actions
- [ ] 4.3 Write unit tests for terminal.js (foreground execution, background mode, command length limit, process CRUD actions)

## 5. Task Management & Memory Tools

- [ ] 5.1 Implement todo tool with read/create/update/complete/clear actions, auto-generated IDs, and file persistence to memory/tools/todo.json
- [ ] 5.2 Implement memory tool with key-value entry write, deduplication by key, maxEntries limit, and markdown frontmatter persistence to memory/context/session_memory.md
- [ ] 5.3 Implement session_search tool with query-based snippet search, conversationId-based full retrieval, and browse listing
- [ ] 5.4 Write unit tests for todo.js, memory.js, and sessionSearch.js (all actions, persistence, edge cases)

## 6. Interaction & Skills Tools

- [ ] 6.1 Implement clarify tool with open-ended question support, choices formatting, and context persistence to memory/context/clarifications.md
- [ ] 6.2 Implement skills_list tool that wraps SkillRegistry.list() and returns skill summaries
- [ ] 6.3 Implement skill_view tool that wraps SkillRegistry.get() and reads the SKILL.md file
- [ ] 6.4 Write unit tests for clarify.js, skills.js (clarify question storage, skills list empty/full, skill view found/not-found)

## 7. Tool Registration

- [ ] 7.1 Create src/tools/index.js with buildToolConfig(config) function and TOOL_PERMISSIONS map
- [ ] 7.2 Implement permission checking logic — register tools only when all required permissions are in config.sandbox.permissions
- [ ] 7.3 Ensure clarify (zero-permission tool) always registers
- [ ] 7.4 Integrate buildToolConfig into index.js — replace empty tools array with await buildToolConfig(config)
- [ ] 7.5 Write unit tests for src/tools/index.js (various permission configs, all tools disabled, all enabled, clarify-only)

## 8. Integration & End-to-End

- [ ] 8.1 Update config.yaml with sandbox.permissions and sandbox.maxReadSize example entries
- [ ] 8.2 Verify index.js passes tools from buildToolConfig to createReactAgent
- [ ] 8.3 Run full test suite (npm run test) and verify all new tests pass
- [ ] 8.4 Run lint and format checks (npm run fix + npm run lint)
- [ ] 8.5 Run coverage report (npm run coverage) and verify 100% for all new files
