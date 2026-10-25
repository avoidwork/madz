# Tasks

## 1. Create the file tool

- [ ] 1.1 Create `src/tools/file/index.js` with the `file` tool and `action` enum (`read`, `write`, `edit`, `delete`, `search`, `ls`, `glob`, `grep`)
- [ ] 1.2 Implement `read` action with `offset`/`limit` pagination and `LINE_NUM|CONTENT` output
- [ ] 1.3 Implement `write` action with content size validation
- [ ] 1.4 Implement `edit` action with `oldString`/`newString` string replacement and `generateUnifiedDiff` output
- [ ] 1.5 Implement `delete` action
- [ ] 1.6 Implement `search` action using ripgrep with native fs fallback
- [ ] 1.7 Implement `ls` action
- [ ] 1.8 Implement `glob` action
- [ ] 1.9 Implement `grep` action
- [ ] 1.10 Wire `validatePath` and `checkFileLimit` from `src/tools/common.js` into all actions
- [ ] 1.11 Restore `generateUnifiedDiff`, `fuzzyMatch`, `levenshteinDistance`, `suggestSimilarFile`, and `nativeSearch` helpers from the removed `filesystem.js`

## 2. Register the file tool

- [ ] 2.1 Add `file` to `TOOL_PERMISSIONS` in `src/tools/index.js` with `["filesystem:read", "filesystem:write"]`
- [ ] 2.2 Add `file` to `TOOL_CLASSIFICATIONS` in `src/tools/index.js`
- [ ] 2.3 Add `file` to the `TOOLS` map in `src/tools/index.js`
- [ ] 2.4 Add a `case "file"` in the `buildToolConfig` switch in `src/tools/index.js`
- [ ] 2.5 Remove the dead `case "readFile"`, `case "writeFile"`, `case "patch"`, `case "searchFiles"` branches from `buildToolConfig`

## 3. Replace the filesystem middleware

- [ ] 3.1 Modify `createEvictionAwareFilesystemMiddleware` in `src/agent/evictionCeiling.js` to supply madz's `file` tool (or no filesystem tools) instead of the library's eight
- [ ] 3.2 Ensure the middleware keeps the name `"FilesystemMiddleware"`
- [ ] 3.3 Verify each subagent gets its own middleware instance in `src/agent/deepAgents.js`

## 4. Tests

- [ ] 4.1 Create `tests/unit/tools/file.test.js` with Zod schema validation for all actions
- [ ] 4.2 Add path validation tests against `allowedPaths`
- [ ] 4.3 Add size-limit enforcement tests
- [ ] 4.4 Add edit/diff application tests
- [ ] 4.5 Create `tests/integration/tools/file.test.js` with read/write/edit/delete round-trip, search and grep on a fixture tree, glob matching
- [ ] 4.6 Update `tests/unit/evictionCeiling.test.js` to assert the middleware now supplies madz's `file` tool (or no filesystem tools) and still keeps the name `"FilesystemMiddleware"`
