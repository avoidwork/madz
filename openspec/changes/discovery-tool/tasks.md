## 1. Create the discovery tool

- [x] 1.1 Create `src/tools/discovery/index.js` with a Zod schema exposing `action` (ls, glob, grep), `path`, `pattern`, and `maxResults`
- [x] 1.2 Move `lsImpl`, `globImpl`, `grepImpl`, and `nativeSearch` from `src/tools/file/index.js` into the new tool
- [x] 1.3 Move `resolveBaseDir`, `resolveFilePath`, and `EXCLUDED_DIRS` into the new tool
- [x] 1.4 Import `validatePath`/`checkFileLimit` from `../common.js`
- [x] 1.5 Export the `discovery` tool and impl functions from the new module

## 2. Strip discovery from file

- [x] 2.1 Remove `ls`, `glob`, `grep` from `VALID_ACTIONS` in `src/tools/file/index.js`
- [x] 2.2 Remove their cases from `fileImpl` switch
- [x] 2.3 Delete `lsImpl`, `globImpl`, `grepImpl`, `nativeSearch`, and now-unused `EXCLUDED_DIRS`, `fg` (fast-glob), `execFile`/`promisify`, and `readdir`/`stat` imports
- [x] 2.4 Keep `read`, `write`, `edit`, `delete` and their helpers (`fuzzyMatch`, `generateUnifiedDiff`, `levenshteinDistance`, `suggestSimilarFile`)
- [x] 2.5 Update the `file` tool description to reflect CRUD-only

## 3. Delete the standalone grep tool

- [x] 3.1 Remove `src/tools/grep/index.js`
- [x] 3.2 Remove the `grep` import from `src/tools/index.js`

## 4. Register the discovery tool

- [x] 4.1 Add `discovery` to `TOOL_PERMISSIONS` with `["filesystem:read"]`
- [x] 4.2 Add `discovery` to `TOOL_CLASSIFICATIONS`
- [x] 4.3 Add `discovery` to `ORCHESTRATOR_TOOLS`
- [x] 4.4 Add `discovery` to `TOOLS`
- [x] 4.5 Remove the `grep` entries from all four maps

## 5. Review deepAgents excludedTools

- [x] 5.1 Review `src/agent/deepAgents.js` `excludedTools` list for the new `discovery` tool name
- [x] 5.2 Update the list if the deepagents library exposes a `discovery` tool

## 6. Move and update tests

- [x] 6.1 Create `tests/unit/tools/discovery.test.js` with schema validation and ls/glob/grep logic
- [x] 6.2 Create `tests/integration/tools/discovery.test.js` with end-to-end discovery behavior
- [x] 6.3 Update `tests/unit/tools/grep.test.js` to import from the new discovery module
- [x] 6.4 Trim `tests/unit/tools/file.test.js` to CRUD-only
- [x] 6.5 Trim `tests/integration/tools/file.test.js` to CRUD-only
- [x] 6.6 Update `tests/unit/tool_index.test.js` guard test to expect `discovery` instead of `grep`

## 7. Verify

- [x] 7.1 Run `npm run test`
- [x] 7.2 Run `npm run lint`
- [x] 7.3 Run `npm run coverage`
