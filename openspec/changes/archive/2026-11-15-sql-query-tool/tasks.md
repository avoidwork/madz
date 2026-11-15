# Tasks

## 1. Dependencies

- [x] 1.1 Add `pg`, `better-sqlite3`, and `mysql2` to package.json dependencies and verify `npm install` succeeds

## 2. Config Schema

- [x] 2.1 Create `src/config/schemas/sql.js` with empty safe defaults (host, port, user, password, database, file) and verify it exports `SqlConfigSchema`
- [x] 2.2 Register `sql: SqlConfigSchema.default({})` in `ConfigSchema` and export `SqlConfigSchema` from `schemas/index.js`
- [x] 2.3 Add `sql` to both `DROPPED_KEYS` lists in `src/config/loader.js` and verify `loadConfig()` succeeds with no `sql:` block

## 3. Tool Implementation

- [x] 3.1 Create `src/tools/sql/drivers/postgres.js` with `name`, `connectionSchema`, and `execute` using `pg`
- [x] 3.2 Create `src/tools/sql/drivers/sqlite.js` with `name`, `connectionSchema`, and `execute` using `better-sqlite3`
- [x] 3.3 Create `src/tools/sql/drivers/mysql.js` with `name`, `connectionSchema`, and `execute` using `mysql2`
- [x] 3.4 Create `src/tools/sql/index.js` with `sqlImpl` dispatching via a `DRIVERS` map, a discriminated union on `driver`, and verify the module exports `sql` as a LangChain tool
- [x] 3.5 Add JSDoc comments to all public functions with `@param` and `@returns` and verify lint passes

## 4. Registry Wiring

- [x] 4.1 Register `sql` in `src/tools/index.js`: import, `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `TOOLS` map, and a `case "sql"` in `buildToolConfig()`, and verify the tool registers when the required permissions are enabled

## 5. Unit Tests

- [x] 5.1 Add `tests/unit/tools/sql.test.js` covering schema validation and mocked driver calls, and verify `npm run test` passes for the new test

## 6. Integration Test

- [x] 6.1 Add `tests/integration/tools/sql.test.js` running queries against an in-memory SQLite database, verifying result shaping and edge cases, and verify `npm run test` passes for the new test

## 7. Verification

- [x] 7.1 Run `npm run lint` and verify it passes
- [x] 7.2 Run `npm run coverage` and verify coverage is maintained

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
