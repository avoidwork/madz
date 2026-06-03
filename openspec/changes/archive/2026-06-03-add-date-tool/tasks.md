## 1. Create date tool implementation

- [x] 1.1 Create `src/tools/date.js` with `dateImpl` function that uses a ternary: `format === "human" ? new Date().toString() : new Date().toISOString()`
- [x] 1.2 Create `createDateTool` factory function using `@langchain/core/tools` with a zod schema that accepts optional `format` string parameter

## 2. Register tool in index

- [x] 2.1 Import `createDateTool` in `src/tools/index.js`
- [x] 2.2 Add `date: []` to `TOOL_PERMISSIONS` (zero required permissions)
- [x] 2.3 Add `date: createDateTool` to `TOOL_FACTORIES`
- [x] 2.4 Add `case "date":` to the switch or default handler in `buildToolConfig`

## 3. Write tests

- [x] 3.1 Create `tests/unit/tools_date.test.js` with tests for ISO 8601 format (default and explicit)
- [x] 3.2 Test for human-readable format output
- [x] 3.3 Test that `createDateTool` returns a LangChain Tool with correct name, description, and schema
- [x] 3.4 Test that `date` tool registers without permissions in `buildToolConfig`

## 4. Verify

- [x] 4.1 Run `npm run lint` to confirm no lint errors
- [x] 4.2 Run `npm run test` to confirm all tests pass
