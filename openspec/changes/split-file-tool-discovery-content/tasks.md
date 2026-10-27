## 1. Move shared helpers to common.js

- [ ] 1.1 Move `grepImpl`, `nativeSearch`, `resolveBaseDir`, `resolveFilePath` from `src/tools/file/index.js` to `src/tools/common.js`
- [ ] 1.2 Add required imports (`execFile`, `promisify`, `readdir`, `stat`, `readFile`, `dirname`, `basename`, `join`, `resolve`, `getProjectCwd`, `loadConfig`) to `src/tools/common.js`
- [ ] 1.3 Update `src/tools/grep/index.js` to import `grepImpl` from `../common.js`

## 2. Create the discovery tool

- [ ] 2.1 Create `src/tools/discovery/index.js` with a Zod schema (`action` enum `["ls", "glob"]`, optional `path`, optional `pattern`)
- [ ] 2.2 Move `lsImpl`, `globImpl`, and `globToRegex` from `src/tools/file/index.js` into `src/tools/discovery/index.js`
- [ ] 2.3 Import `resolveFilePath` and `validatePath` from `../common.js` in the discovery module

## 3. Simplify the file tool

- [ ] 3.1 Set `VALID_ACTIONS` to `["read", "write", "edit", "delete"]` in `src/tools/file/index.js`
- [ ] 3.2 Remove the `ls`/`glob`/`grep` cases from `fileImpl`
- [ ] 3.3 Remove the stale `search` reference from the file tool description
- [ ] 3.4 Drop `pattern`/`maxResults` from the file tool schema
- [ ] 3.5 Import `resolveFilePath` and `validatePath` from `../common.js` in the file module

## 4. Register the discovery tool

- [ ] 4.1 Add `discovery` to `ORCHESTRATOR_TOOLS` in `src/tools/index.js`
- [ ] 4.2 Add `discovery` to the `TOOLS` map in `src/tools/index.js`
- [ ] 4.3 Add `discovery: ["filesystem:read"]` to `TOOL_PERMISSIONS` in `src/tools/index.js`
- [ ] 4.4 Add a permission switch case for `discovery` in `buildToolConfig`

## 5. Update tests

- [ ] 5.1 Update `tests/unit/tools/file.test.js`: action list to `["read", "write", "edit", "delete"]`; remove ls/glob/grep tests; update imports for moved helpers
- [ ] 5.2 Update `tests/integration/tools/file.test.js`: remove ls/glob/grep tests; update imports
- [ ] 5.3 Create `tests/unit/tools/discovery.test.js` covering ls/glob
- [ ] 5.4 Create `tests/integration/tools/discovery.test.js` covering ls/glob
- [ ] 5.5 Update `tests/unit/tools/grep.test.js` to import `grepImpl`/`nativeSearch` from `common.js`

## 6. Verify

- [ ] 6.1 Run `npm run test` and confirm all pass
- [ ] 6.2 Run `npm run lint` and confirm clean
- [ ] 6.3 Run `npm run coverage` and confirm maintained
