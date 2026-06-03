## Tasks

1. **Implement `src/tools/date.js`**
   - `dateImpl(input, options)` returns `JSON.stringify({ ok: true, dateTime: new Date().toISOString() })`.
   - Export `date` as a LangChain `tool()` with name `"date"`, description, and a schema with no required fields.
   - Export `createDateTool(options)` factory that binds options and wraps `dateImpl`.
   - JSDoc `@param` and `@returns` annotations on all public functions.

2. **Register tool in `src/tools/index.js`**
   - Import `createDateTool` from `./date.js`.
   - Add `date: []` to `TOOL_PERMISSIONS` (empty = zero permissions, always registers).
   - Add `date: createDateTool` to `TOOL_FACTORIES`.
   - No new `case` needed in `buildToolConfig()` switch — the `default` path handles zero-permission tools.

3. **Write `tests/unit/tools/date.test.js`**
   - Test `dateImpl()` returns `ok: true` and a valid ISO 8601 `dateTime` string.
   - Test `createDateTool(options)` returns a LangChain Tool with correct `name` and `description`.
   - Mock nothing — pure time query, no dependencies to stub.

4. **Verify**
   - Run `npm run lint` to confirm oxlint and oxfmt pass.
   - Run `npm run test` to confirm all tests pass.
   - Run `npm run coverage` to confirm 100% line coverage for `date.js`.
