# Tasks

## 1. Dependencies

- [ ] 1.1 Add `archiver`, `unzipper`, and `tar` to package.json dependencies and verify `npm install` succeeds

## 2. Tool Implementation

- [ ] 2.1 Create `src/tools/archive/index.js` with `archiveImpl` supporting create/extract/list across zip/tar/gzip, using `validatePath()` for sandbox enforcement, and verify the module exports `archive` as a LangChain tool
- [ ] 2.2 Add JSDoc comments to all public functions with `@param` and `@returns` and verify lint passes

## 3. Registry Wiring

- [ ] 3.1 Register `archive` in `src/tools/index.js`: import, `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `TOOLS` map, and a `case "archive"` in `buildToolConfig()`, and verify the tool registers when filesystem:read/write permissions are enabled

## 4. Unit Tests

- [ ] 4.1 Add `tests/unit/tools/archive.test.js` covering Zod schema validation for create/extract/list and zip/tar/gzip formats, and verify `npm run test` passes for the new test

## 5. Integration Test

- [ ] 5.1 Add `tests/integration/tools/archive.test.js` doing a create-then-extract round-trip for zip/tar/gzip, verifying contents, and covering path-traversal and empty-archive edge cases, and verify `npm run test` passes for the new test

## 6. Verification

- [ ] 6.1 Run `npm run lint` and verify it passes
- [ ] 6.2 Run `npm run coverage` and verify coverage is maintained

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
