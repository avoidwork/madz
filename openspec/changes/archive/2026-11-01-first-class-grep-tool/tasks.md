## 1. Create the grep tool

- [x] 1.1 Create `src/tools/grep/index.js` with a Zod schema (`pattern` required; `path`, `maxResults` optional) and an impl that reuses `grepImpl`/`nativeSearch` from `src/tools/file/index.js`.

## 2. Register the tool

- [x] 2.1 Add `grep` to `TOOL_PERMISSIONS` (`filesystem:read`), `TOOL_CLASSIFICATIONS` (search, research, coding, debug, code-review, security-audit, testing, performance, documentation), `ORCHESTRATOR_TOOLS`, and the `TOOLS` map in `src/tools/index.js`.

## 3. Remove the redundant search action

- [x] 3.1 Drop `search` from `VALID_ACTIONS` in `src/tools/file/index.js` and remove `searchImpl`/`search` from the `fileImpl` switch.

## 4. Write unit tests

- [x] 4.1 Add `tests/unit/tools/grep.test.js` covering schema validation, matches found, no matches, and native fallback.
- [x] 4.2 Update `tests/unit/tool_index.test.js` to add `grep` to the expected tools list.
- [x] 4.3 Update `tests/unit/tools/file.test.js` to remove references to the `search` action.

## 5. Verify

- [ ] 5.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm everything passes.
