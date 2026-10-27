## 1. Move shared helpers to common.js

- [x] 1.1 Move `grepImpl`, `nativeSearch`, `resolveBaseDir`, `resolveFilePath` from `src/tools/file/index.js` to `src/tools/common.js`
- [x] 1.2 Add required imports (`execFile`, `promisify`, `readdir`, `stat`, `readFile`, `dirname`, `basename`, `join`, `resolve`, `getProjectCwd`, `loadConfig`) to `src/tools/common.js`
- [x] 1.3 Update `src/tools/grep/index.js` to import `grepImpl` from `../common.js`

## 2. Create the discovery tool

- [x] 2.1 Create `src/tools/discovery/index.js` with a Zod schema (`action` enum `["ls", "glob"]`, optional `path`, optional `pattern`)
- [x] 2.2 Move `lsImpl`, `globImpl`, and `globToRegex` from `src/tools/file/index.js` into `src/tools/discovery/index.js`
- [x] 2.3 Import `resolveFilePath` and `validatePath` from `../common.js` in the discovery module

## 3. Simplify the file tool

- [x] 3.1 Set `VALID_ACTIONS` to `["read", "write", "edit", "delete"]` in `src/tools/file/index.js`
- [x] 3.2 Remove the `ls`/`glob`/`grep` cases from `fileImpl`
- [x] 3.3 Remove the stale `search` reference from the file tool description
- [x] 3.4 Drop `pattern`/`maxResults` from the file tool schema
- [x] 3.5 Import `resolveFilePath` and `validatePath` from `../common.js` in the file module

## 4. Register the discovery tool

- [x] 4.1 Add `discovery` to `ORCHESTRATOR_TOOLS` in `src/tools/index.js`
- [x] 4.2 Add `discovery` to the `TOOLS` map in `src/tools/index.js`
- [x] 4.3 Add `discovery: ["filesystem:read"]` to `TOOL_PERMISSIONS` in `src/tools/index.js`
- [x] 4.4 Add a permission switch case for `discovery` in `buildToolConfig`

## 5. Update tests

- [x] 5.1 Update `tests/unit/tools/file.test.js`: action list to `["read", "write", "edit", "delete"]`; remove ls/glob/grep tests; update imports for moved helpers
- [x] 5.2 Update `tests/integration/tools/file.test.js`: remove ls/glob/grep tests; update imports
- [x] 5.3 Create `tests/unit/tools/discovery.test.js` covering ls/glob
- [x] 5.4 Create `tests/integration/tools/discovery.test.js` covering ls/glob
- [x] 5.5 Update `tests/unit/tools/grep.test.js` to import `grepImpl`/`nativeSearch` from `common.js`

## 6. Verify

- [x] 6.1 Run `npm run test` and confirm all pass
- [x] 6.2 Run `npm run lint` and confirm clean
- [x] 6.3 Run `npm run coverage` and confirm maintained
