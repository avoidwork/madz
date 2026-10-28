## 1. Create the discovery tool

- [ ] 1.1 Create `src/tools/discovery/index.js` with a Zod schema exposing `action` (ls, glob, grep), `path`, `pattern`, and `maxResults`
- [ ] 1.2 Move `lsImpl`, `globImpl`, `grepImpl`, and `nativeSearch` from `src/tools/file/index.js` into the new tool
- [ ] 1.3 Move `resolveBaseDir`, `resolveFilePath`, and `EXCLUDED_DIRS` into the new tool
- [ ] 1.4 Import `validatePath`/`checkFileLimit` from `../common.js`
- [ ] 1.5 Export the `discovery` tool and impl functions from the new module

## 2. Strip discovery from file

- [ ] 2.1 Remove `ls`, `glob`, `grep` from `VALID_ACTIONS` in `src/tools/file/index.js`
- [ ] 2.2 Remove their cases from `fileImpl` switch
- [ ] 2.3 Delete `lsImpl`, `globImpl`, `grepImpl`, `nativeSearch`, and now-unused `EXCLUDED_DIRS`, `fg` (fast-glob), `execFile`/`promisify`, and `readdir`/`stat` imports
- [ ] 2.4 Keep `read`, `write`, `edit`, `delete` and their helpers (`fuzzyMatch`, `generateUnifiedDiff`, `levenshteinDistance`, `suggestSimilarFile`)
- [ ] 2.5 Update the `file` tool description to reflect CRUD-only

## 3. Delete the standalone grep tool

- [ ] 3.1 Remove `src/tools/grep/index.js`
- [ ] 3.2 Remove the `grep` import from `src/tools/index.js`

## 4. Register the discovery tool

- [ ] 4.1 Add `discovery` to `TOOL_PERMISSIONS` with `["filesystem:read"]`
- [ ] 4.2 Add `discovery` to `TOOL_CLASSIFICATIONS`
- [ ] 4.3 Add `discovery` to `ORCHESTRATOR_TOOLS`
- [ ] 4.4 Add `discovery` to `TOOLS`
- [ ] 4.5 Remove the `grep` entries from all four maps

## 5. Review deepAgents excludedTools

- [ ] 5.1 Review `src/agent/deepAgents.js` `excludedTools` list for the new `discovery` tool name
- [ ] 5.2 Update the list if the deepagents library exposes a `discovery` tool

## 6. Move and update tests

- [ ] 6.1 Create `tests/unit/tools/discovery.test.js` with schema validation and ls/glob/grep logic
- [ ] 6.2 Create `tests/integration/tools/discovery.test.js` with end-to-end discovery behavior
- [ ] 6.3 Update `tests/unit/tools/grep.test.js` to import from the new discovery module
- [ ] 6.4 Trim `tests/unit/tools/file.test.js` to CRUD-only
- [ ] 6.5 Trim `tests/integration/tools/file.test.js` to CRUD-only
- [ ] 6.6 Update `tests/unit/tool_index.test.js` guard test to expect `discovery` instead of `grep`

## 7. Verify

- [ ] 7.1 Run `npm run test`
- [ ] 7.2 Run `npm run lint`
- [ ] 7.3 Run `npm run coverage`
